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
  runApp(const GiveWayApp());
}

class GiveWayApp extends StatefulWidget {
  const GiveWayApp({super.key});

  @override
  State<GiveWayApp> createState() => _GiveWayAppState();
}

class _GiveWayAppState extends State<GiveWayApp> {
  ThemeMode _themeMode = ThemeMode.dark;
  Map<String, dynamic>? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSession();
    _autoTheme();
  }

  void _autoTheme() {
    final hour = DateTime.now().hour;
    setState(() {
      _themeMode = (hour >= 6 && hour < 18) ? ThemeMode.light : ThemeMode.dark;
    });
  }

  Future<void> _loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    final role = prefs.getString('role');
    final id = prefs.getString('userId');
    final name = prefs.getString('userName');
    final expiresAt = prefs.getInt('expiresAt') ?? 0;

    if (token != null && expiresAt > DateTime.now().millisecondsSinceEpoch) {
      setState(() {
        _user = {'token': token, 'role': role, 'id': id, 'name': name};
        _loading = false;
      });
    } else {
      await prefs.clear();
      setState(() => _loading = false);
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

  void _toggleTheme() {
    setState(() {
      _themeMode =
          _themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GiveWay',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorSchemeSeed: const Color(0xFF00E5FF),
        textTheme: GoogleFonts.interTextTheme(),
        scaffoldBackgroundColor: const Color(0xFFF5F7FA),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFF00E5FF),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
        scaffoldBackgroundColor: const Color(0xFF02050A),
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
                    )
                  : AdminDashboard(
                      user: _user!,
                      onLogout: _onLogout,
                      onToggleTheme: _toggleTheme,
                    ),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF02050A),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00E5FF).withOpacity(0.3),
                    blurRadius: 20,
                    spreadRadius: 5,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(30),
                child: Image.asset(
                  'assets/logo.png',
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(height: 24),
            const CircularProgressIndicator(color: Color(0xFF00E5FF)),
          ],
        ),
      ),
    );
  }
}
