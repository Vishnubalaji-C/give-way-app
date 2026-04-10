import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'qr_link_screen.dart';

class AuthScreen extends StatefulWidget {
  final Function(Map<String, dynamic>) onLogin;
  const AuthScreen({super.key, required this.onLogin});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with TickerProviderStateMixin {
  bool _isLogin = true;
  String _role = 'police';
  final _idCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _pinCtrl = TextEditingController();
  final _badgeCtrl = TextEditingController();
  final _stationCtrl = TextEditingController();
  final _deptCtrl = TextEditingController();
  String _access = 'Standard';
  String? _error;
  bool _loading = false;

  late AnimationController _fadeCtrl;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600))..forward();
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_idCtrl.text.isEmpty || _pinCtrl.text.isEmpty) return;
    setState(() { _error = null; _loading = true; });

    try {
      Map<String, dynamic> data;
      if (_isLogin) {
        data = await ApiService.login(id: _idCtrl.text, pin: _pinCtrl.text);
      } else {
        data = await ApiService.register(
          id: _idCtrl.text,
          pin: _pinCtrl.text,
          role: _role,
          badge: _badgeCtrl.text,
          station: _stationCtrl.text,
          dept: _deptCtrl.text,
          access: _access,
          fullName: _nameCtrl.text,
        );
      }
      widget.onLogin({
        ...data['user'],
        'token': data['token'],
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCyan = _role == 'police';
    final accent = isCyan ? const Color(0xFF00E5FF) : const Color(0xFFFFB700);

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: Stack(
        children: [
          // Cinematic background glow
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accent.withOpacity(0.05),
              ),
            ),
          ),
          
          Center(
            child: FadeTransition(
              opacity: _fadeCtrl,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Brand Identity
                    Container(
                      width: 88,
                      height: 88,
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: Colors.white.withOpacity(0.08)),
                        boxShadow: [
                          BoxShadow(color: accent.withOpacity(0.1), blurRadius: 40, spreadRadius: -10)
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(26),
                        child: Image.asset('assets/logo.png', fit: BoxFit.cover),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'MakeWay ATES',
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.5),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'SECURE TERMINAL ACCESS'.toUpperCase(),
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white.withOpacity(0.2), letterSpacing: 3),
                    ),
                    const SizedBox(height: 48),

                    // Authentication Surface
                    Container(
                      constraints: const BoxConstraints(maxWidth: 400),
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.02),
                        borderRadius: BorderRadius.circular(40),
                        border: Border.all(color: Colors.white.withOpacity(0.04)),
                      ),
                      child: Column(
                        children: [
                          // Enhanced Role Selector
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white.withOpacity(0.05)),
                            ),
                            child: Row(
                              children: [
                                _roleSwitch('police', 'TACTICAL', Icons.security_rounded, const Color(0xFF00E5FF)),
                                _roleSwitch('admin', 'COMMAND', Icons.hub_rounded, const Color(0xFFFFB700)),
                              ],
                            ),
                          ),
                          const SizedBox(height: 32),

                          if (_error != null) _errorAlert(),

                          // Input Matrix
                          if (!_isLogin) ...[
                             _buildInputField(
                              controller: _nameCtrl,
                              label: 'FULL LEGAL IDENTITY',
                              hint: 'Officer Name',
                              icon: Icons.person_rounded,
                              accent: accent,
                            ),
                            const SizedBox(height: 20),
                          ],

                          _buildInputField(
                            controller: _idCtrl,
                            label: isCyan ? 'SERVICE ID' : 'COMMAND ID',
                            hint: isCyan ? 'PL-8849' : 'ADM-01',
                            icon: Icons.fingerprint_rounded,
                            accent: accent,
                          ),
                          const SizedBox(height: 20),
                          _buildInputField(
                            controller: _pinCtrl,
                            label: 'SECURE PIN',
                            hint: '••••••',
                            icon: Icons.lock_rounded,
                            accent: accent,
                            isPassword: true,
                          ),

                          const SizedBox(height: 40),

                          // Action Execution
                          SizedBox(
                            width: double.infinity,
                            height: 58,
                            child: ElevatedButton(
                              onPressed: _loading ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: accent,
                                foregroundColor: Colors.black,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                              ),
                              child: _loading 
                                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                                : Text(_isLogin ? 'AUTHORIZE' : 'INITIALIZE', 
                                    style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2, fontSize: 13)),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 32),
                    
                    TextButton(
                      onPressed: () => setState(() { _isLogin = !_isLogin; _error = null; }),
                      child: Text(
                        _isLogin ? 'INITIALIZE NEW UNIT' : 'EXISTING COMMAND ACCESS',
                        style: TextStyle(color: Colors.white.withOpacity(0.2), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1),
                      ),
                    ),

                    const SizedBox(height: 32),
                    const Divider(color: Colors.white10),
                    const SizedBox(height: 32),

                    // QR Sync Portal
                    InkWell(
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const QrLinkScreen())),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                        decoration: BoxDecoration(
                          color: accent.withOpacity(0.03),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: accent.withOpacity(0.1)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.qr_code_scanner_rounded, color: accent, size: 18),
                            const SizedBox(width: 12),
                            Text('SYNC STATION', style: TextStyle(color: accent, fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 1.5)),
                          ],
                        ),
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

  Widget _roleSwitch(String role, String label, IconData icon, Color color) {
    final active = _role == role;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _role = role),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: active ? color.withOpacity(0.1) : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: active ? color : Colors.white12),
              const SizedBox(width: 8),
              Text(label, style: TextStyle(color: active ? color : Colors.white12, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 1)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _errorAlert() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.red.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.withOpacity(0.1)),
      ),
      child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    required Color accent,
    bool isPassword = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white24, fontWeight: FontWeight.w900, fontSize: 8, letterSpacing: 1.5)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: isPassword,
          style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.white10),
            prefixIcon: Icon(icon, color: accent.withOpacity(0.5), size: 18),
            filled: true,
            fillColor: Colors.white.withOpacity(0.02),
            contentPadding: const EdgeInsets.all(20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide.none),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide(color: Colors.white.withOpacity(0.05))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(20), borderSide: BorderSide(color: accent.withOpacity(0.3))),
          ),
        ),
      ],
    );
  }
}
