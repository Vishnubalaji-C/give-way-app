import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AuthScreen extends StatefulWidget {
  final Function(Map<String, dynamic>) onLogin;
  const AuthScreen({super.key, required this.onLogin});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
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
      backgroundColor: const Color(0xFF02050A),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 420),
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: const Color(0xFF0D1827).withOpacity(0.85),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: accent.withOpacity(0.2)),
              boxShadow: [
                BoxShadow(
                  color: accent.withOpacity(0.08),
                  blurRadius: 40,
                  spreadRadius: 0,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top accent line
                Container(
                  height: 3,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(2),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00E5FF), Color(0xFF00FF88)],
                    ),
                  ),
                ),

                // Logo
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00E5FF), Color(0xFF00FF88)],
                    ),
                  ),
                  child: const Center(
                    child: Text('GW',
                        style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                            color: Colors.black)),
                  ),
                ),
                const SizedBox(height: 20),

                Text(
                  _isLogin ? 'System Authentication' : 'Secure Registration',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 20),

                // Error
                if (_error != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red.withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.shield, color: Colors.red, size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(_error!,
                              style: const TextStyle(
                                  color: Colors.redAccent,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),

                // Role Selector
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F1923),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white10),
                  ),
                  padding: const EdgeInsets.all(4),
                  child: Row(
                    children: [
                      _roleBtn('police', 'Police Duty', Icons.shield,
                          const Color(0xFF00E5FF)),
                      _roleBtn('admin', 'Control Room', Icons.security,
                          const Color(0xFFFFB700)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Unique ID
                _buildInput(
                  controller: _idCtrl,
                  label: isCyan ? 'Officer Unique ID' : 'Admin System ID',
                  hint: isCyan ? 'e.g., PL-8849' : 'e.g., ADM-091',
                  icon: Icons.fingerprint,
                  accent: accent,
                ),
                const SizedBox(height: 12),

                // PIN
                _buildInput(
                  controller: _pinCtrl,
                  label: 'Secure PIN',
                  hint: '••••••',
                  icon: Icons.lock,
                  accent: accent,
                  obscure: true,
                ),

                // Registration Extra Fields
                if (!_isLogin) ...[
                  const SizedBox(height: 16),
                  
                  // Full Name
                  _buildInput(
                    controller: _nameCtrl,
                    label: 'Legal Full Name',
                    hint: 'e.g. John Doe',
                    icon: Icons.person,
                    accent: accent,
                  ),

                  const SizedBox(height: 16),
                  Divider(color: Colors.white.withOpacity(0.05)),
                  const SizedBox(height: 16),
                  Divider(color: Colors.white.withOpacity(0.05)),
                  const SizedBox(height: 8),
                  if (_role == 'police') ...[
                    Row(
                      children: [
                        Expanded(
                          child: _buildInput(
                            controller: _badgeCtrl,
                            label: 'Badge No.',
                            accent: accent,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildInput(
                            controller: _stationCtrl,
                            label: 'Station Code',
                            accent: accent,
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (_role == 'admin') ...[
                    Row(
                      children: [
                        Expanded(
                          child: _buildInput(
                            controller: _deptCtrl,
                            label: 'Dept Region',
                            accent: accent,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F1923),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.white10),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _access,
                                dropdownColor: const Color(0xFF0F1923),
                                style: const TextStyle(
                                    color: Colors.white70, fontSize: 13),
                                items: ['Standard', 'Super-User']
                                    .map((e) => DropdownMenuItem(
                                        value: e, child: Text(e)))
                                    .toList(),
                                onChanged: (v) =>
                                    setState(() => _access = v ?? 'Standard'),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],

                const SizedBox(height: 24),

                // Submit
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accent,
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      textStyle: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                          letterSpacing: 2),
                    ),
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.black))
                        : Text(
                            _isLogin ? 'AUTHORIZE ACCESS' : 'REGISTER ID'),
                  ),
                ),

                const SizedBox(height: 16),
                TextButton(
                  onPressed: () =>
                      setState(() { _isLogin = !_isLogin; _error = null; }),
                  child: Text(
                    _isLogin
                        ? "New user? Create a Secure Identity"
                        : "Already have an ID? Proceed to Login",
                    style: TextStyle(
                        color: Colors.white38,
                        fontSize: 12,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _roleBtn(String role, String label, IconData icon, Color color) {
    final selected = _role == role;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _role = role),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? color.withOpacity(0.15) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
                color: selected ? color.withOpacity(0.4) : Colors.transparent),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 14,
                  color: selected ? color : Colors.white38),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: selected ? color : Colors.white38)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String label,
    String? hint,
    IconData? icon,
    required Color accent,
    bool obscure = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.white38)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          obscureText: obscure,
          style: const TextStyle(color: Colors.white70, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.white12),
            prefixIcon:
                icon != null ? Icon(icon, size: 16, color: accent) : null,
            filled: true,
            fillColor: const Color(0xFF0F1923),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: Colors.white10),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: Colors.white10),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: accent),
            ),
          ),
        ),
      ],
    );
  }
}
