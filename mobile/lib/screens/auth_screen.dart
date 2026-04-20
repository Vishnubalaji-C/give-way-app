import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class AuthScreen extends StatefulWidget {
  final Function(Map<String, dynamic>) onLogin;

  const AuthScreen({super.key, required this.onLogin});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with SingleTickerProviderStateMixin {
  bool _isLogin = true;
  final TextEditingController _idController = TextEditingController();
  final TextEditingController _pinController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  
  bool _loading = false;
  String? _error;

  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
    _fadeAnim = CurvedAnimation(parent: _animController, curve: Curves.easeInOut);
    _animController.forward();
  }

  @override
  void dispose() {
    _idController.dispose();
    _pinController.dispose();
    _nameController.dispose();
    _animController.dispose();
    super.dispose();
  }

  void _toggleMode() {
    setState(() {
      _isLogin = !_isLogin;
      _error = null;
    });
    _animController.reset();
    _animController.forward();
  }

  Future<void> _submit() async {
    final id = _idController.text.trim();
    final pin = _pinController.text.trim();
    final name = _nameController.text.trim();

    if (id.isEmpty || pin.isEmpty || (!_isLogin && name.isEmpty)) {
      setState(() => _error = 'Please fill all biometric fields.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      Map<String, dynamic> result;
      if (_isLogin) {
        result = await ApiService.login(id, pin);
      } else {
        result = await ApiService.register({
          'id': id,
          'pin': pin,
          'role': 'admin',
          'fullName': name,
        });
        setState(() {
          _isLogin = true;
          _loading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Identity Created. Please authorize login.'))
        );
        return;
      }

      if (mounted) {
        widget.onLogin({...result['user'], 'token': result['token']});
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: Stack(
        children: [
          // Background Glows
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                color: const Color(0xFF00E5FF).withOpacity(0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),

          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
              child: FadeTransition(
                opacity: _fadeAnim,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    Center(
                      child: Container(
                        width: 80,
                        height: 80,
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.03),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.white.withOpacity(0.05)),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(22),
                          child: Image.asset('assets/logo.png', fit: BoxFit.cover),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    Center(
                      child: Column(
                        children: [
                          Text(
                            'GiveWay ATES'.toUpperCase(),
                            style: GoogleFonts.outfit(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 4,
                              color: const Color(0xFF00E5FF).withOpacity(0.5),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _isLogin ? 'Mission Authorization' : 'Initialize Identity',
                            style: GoogleFonts.outfit(
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 48),

                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(16),
                        margin: const EdgeInsets.bottom(24),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.red.withOpacity(0.2)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 20),
                            const SizedBox(width: 12),
                            Expanded(child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold))),
                          ],
                        ),
                      ),

                    if (!_isLogin)
                      _buildField('Full Legal Name', _nameController, Icons.person_rounded),
                    
                    _buildField('Operator ID', _idController, Icons.fingerprint_rounded),
                    _buildField('Authorization PIN', _pinController, Icons.lock_rounded, isPassword: true),

                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00E5FF),
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 20),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          elevation: 0,
                        ),
                        onPressed: _loading ? null : _submit,
                        child: _loading 
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                          : Text(
                              (_isLogin ? 'AUTHORIZE ACCESS' : 'INITIALIZE ATES').toUpperCase(),
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 2),
                            ),
                      ),
                    ),

                    const SizedBox(height: 32),
                    Center(
                      child: Column(
                        children: [
                          TextButton(
                            onPressed: () {
                              _idController.text = 'admin';
                              _pinController.text = '1234';
                              _submit();
                            },
                            child: Text(
                              'ONE-TAP DEMO ACCESS'.toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 2,
                                color: const Color(0xFF00E5FF).withOpacity(0.8),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: _toggleMode,
                            child: Text(
                              _isLogin ? 'CREATE NEW IDENTITY' : 'RETURN TO GATEWAY',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                                color: Colors.white.withOpacity(0.2),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _roleBtn(String label, String role, Color color) {
    final active = _role == role;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _role = role),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? color.withOpacity(0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? color.withOpacity(0.3) : Colors.transparent),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
                color: active ? color : Colors.white24,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController controller, IconData icon, {bool isPassword = false}) {
    const accent = Color(0xFF00E5FF);
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white.withOpacity(0.2), letterSpacing: 2)),
          const SizedBox(height: 12),
          TextField(
            controller: controller,
            obscureText: isPassword,
            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
            decoration: InputDecoration(
              prefixIcon: Icon(icon, color: accent.withOpacity(0.5), size: 20),
              filled: true,
              fillColor: Colors.white.withOpacity(0.02),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: Border.all(color: Colors.white.withOpacity(0.05))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: Border.all(color: accent.withOpacity(0.3))),
              hintText: 'Enter $label',
              hintStyle: TextStyle(color: Colors.white.withOpacity(0.1), fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}
