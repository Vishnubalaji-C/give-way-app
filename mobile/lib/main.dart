import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/auth_screen.dart';
import 'screens/police_dashboard.dart';
import 'screens/admin_dashboard.dart';
import 'services/api_service.dart';
import 'services/ws_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Start Secure Software Discovery
  final ws = WsService();
  ws.startDiscovery();
  
  runApp(const MakeWayApp());
}

class MakeWayApp extends StatefulWidget {
  const MakeWayApp({super.key});

  @override
  State<MakeWayApp> createState() => _MakeWayAppState();
}

class _MakeWayAppState extends State<MakeWayApp> {
  ThemeMode _themeMode = ThemeMode.dark;
  Map<String, dynamic>? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final role = prefs.getString('role');
    final id = prefs.getString('userId');
    final name = prefs.getString('userName');
    final expiresAt = prefs.getInt('expiresAt') ?? 0;

    if (token != null && expiresAt > DateTime.now().millisecondsSinceEpoch) {
      if (mounted) {
        setState(() {
          _user = {'token': token, 'role': role, 'id': id, 'name': name};
          _loading = false;
        });
      }
    } else {
      await prefs.clear();
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _onLogin(Map<String, dynamic> userData) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', userData['token']);
    await prefs.setString('role', userData['role']);
    await prefs.setString('userId', userData['id']);
    await prefs.setString('userName', userData['name'] ?? '');
    await prefs.setInt('expiresAt',
        DateTime.now().millisecondsSinceEpoch + 7 * 24 * 60 * 60 * 1000);
    setState(() => _user = userData);
  }

  Future<void> _onLogout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    setState(() => _user = null);
  }

  Future<void> _switchRole(String newRole) async {
    if (_user == null) return;
    try {
      final res = await ApiService.switchRole(_user!['token'], newRole);
      if (res['success'] == true) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('role', newRole);
        if (res['user'] != null && res['user']['name'] != null) {
          await prefs.setString('userName', res['user']['name']);
        }
        
        setState(() {
          _user = {
            ..._user!,
            'role': newRole,
            if (res['user'] != null && res['user']['name'] != null) 'name': res['user']['name'],
          };
        });
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Persona Switched to ${newRole.toUpperCase()}'),
              backgroundColor: const Color(0xFF00E5FF),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Switch Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MakeWay ATES',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorSchemeSeed: const Color(0xFF00E5FF),
        textTheme: GoogleFonts.interTextTheme(),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        scaffoldBackgroundColor: const Color(0xFF030712),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00E5FF),
          brightness: Brightness.dark,
          surface: const Color(0xFF030712),
        ),
      ),
      home: _loading
          ? const _SplashScreen()
          : _user == null
              ? AuthScreen(onLogin: _onLogin)
              : _user!['role'] == 'police'
                      ? PoliceDashboard(
                      user: _user!,
                      onLogout: _onLogout,
                      onToggleTheme: _toggleTheme,
                      onSwitchRole: _switchRole,
                    )
                  : AdminDashboard(
                      user: _user!,
                      onLogout: _onLogout,
                      onToggleTheme: _toggleTheme,
                      onSwitchRole: _switchRole,
                    ),
    );
  }
}

class _SplashScreen extends StatefulWidget {
  const _SplashScreen();

  @override
  State<_SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<_SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.5, curve: Curves.easeIn)),
    );
    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.6, curve: Curves.easeOutBack)),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: ScaleTransition(
            scale: _scaleAnimation,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 120,
                  height: 120,
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.03),
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(color: Colors.white.withOpacity(0.05)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF00E5FF).withOpacity(0.15),
                        blurRadius: 40,
                        spreadRadius: -5,
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(30),
                    child: Image.asset('assets/logo.png', fit: BoxFit.cover),
                  ),
                ),
                const SizedBox(height: 48),
                Text(
                  'MakeWay'.toUpperCase(),
                  style: GoogleFonts.outfit(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 12,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                   width: 30,
                   height: 1,
                   color: const Color(0xFF00E5FF).withOpacity(0.3),
                ),
                const SizedBox(height: 12),
                Text(
                  'MISSION CONTROL CENTER'.toUpperCase(),
                  style: GoogleFonts.inter(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 3,
                    color: Colors.white.withOpacity(0.2),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
