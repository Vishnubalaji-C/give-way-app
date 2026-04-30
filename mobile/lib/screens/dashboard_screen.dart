import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/ws_service.dart';
import '../services/api_service.dart';
import '../widgets/lane_card.dart';
import '../widgets/alert_tile.dart';
import '../widgets/junction_sim.dart';
import '../widgets/analytics_charts.dart';
import 'package:showcaseview/showcaseview.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'scanner_screen.dart';

import 'dashboard_tab.dart';
import 'camera_screen.dart';
import 'command_screen.dart';
import 'analytics_screen.dart';


class DashboardScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;

  const DashboardScreen({
    super.key,
    required this.user,
    required this.onLogout,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final WsService _ws = WsService();
  Map<String, dynamic> _state = {};
  Map<String, dynamic> _analytics = {};
  List<Map<String, dynamic>> _alerts = [];
  int _tabIndex = 0;
  Timer? _latencyTimer;
  int _latency = 0;

  final GlobalKey _keyStatus = GlobalKey();
  final GlobalKey _keyMatrix = GlobalKey();
  final GlobalKey _keyAction = GlobalKey();
  final GlobalKey _keyLink = GlobalKey();
  final GlobalKey _keyNav = GlobalKey();

  @override
  void initState() {
    super.initState();
    _checkFirstLaunch();
    _ws.connect();
    _ws.stateStream.listen((s) {
      if (mounted) setState(() => _state = s);
    });
    _ws.alertStream.listen((a) {
      if (mounted) {
        setState(() {
          _alerts.insert(0, a);
          if (_alerts.length > 50) _alerts.removeLast();
        });
      }
    });
    _latencyTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) {
        setState(() => _latency = 25 + (DateTime.now().millisecond % 50));
      }
    });
    _fetchAnalytics();
  }

  Future<void> _checkFirstLaunch() async {
    final prefs = await SharedPreferences.getInstance();
    final hasSeen = prefs.getBool('giveway_mobile_tutorial') ?? false;
    if (!hasSeen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ShowCaseWidget.of(context).startShowCase([_keyStatus, _keyMatrix, _keyAction, _keyNav, _keyLink]);
      });
      await prefs.setBool('giveway_mobile_tutorial', true);
    }
  }

  Future<void> _fetchAnalytics() async {
    try {
      final data = await ApiService.getAnalytics();
      if (mounted) setState(() => _analytics = data);
    } catch (e) {
      debugPrint('Analytics Fetch Failure: $e');
    }
  }

  @override
  void dispose() {
    _ws.dispose();
    _latencyTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accent = const Color(0xFF00E5FF);

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFF030712),
        title: Showcase(
          key: _keyStatus,
          description: 'Top panel shows your active connection status, latency, and current persona.',
          child: _buildAppTitle(),
        ),
        actions: [
          Showcase(
            key: _keyLink,
            description: 'Link new junction devices or cameras by scanning their QR code.',
            child: IconButton(
              icon: const Icon(Icons.qr_code_scanner_rounded, color: Colors.cyanAccent, size: 20),
              onPressed: () async {
                final synced = await Navigator.push(context, MaterialPageRoute(builder: (c) => ScannerScreen()));
                if (synced == true) _ws.startDiscovery();
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.help_outline_rounded, color: Colors.amber, size: 20),
            onPressed: () {
              ShowCaseWidget.of(context).startShowCase([_keyStatus, _keyMatrix, _keyAction, _keyNav, _keyLink]);
            },
            tooltip: 'Show Tutorial',
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.white24, size: 20),
            onPressed: widget.onLogout,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: accent,
        backgroundColor: const Color(0xFF1F2937),
        onRefresh: () async {
          HapticFeedback.mediumImpact();
          await _fetchAnalytics();
          _ws.send('GET_STATE');
          await Future.delayed(const Duration(milliseconds: 800));
        },
        child: IndexedStack(
          index: _tabIndex,
          children: [
            DashboardTab(state: _state, alerts: _alerts, ws: _ws, userName: widget.user['name'] ?? 'Operator'),
            CommandScreen(state: _state, ws: _ws, alerts: _alerts),
            AnalyticsScreen(analytics: _analytics, state: _state),
          ],
        ),
      ),
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(canvasColor: const Color(0xFF030712)),
        child: Showcase(
          key: _keyNav,
          description: 'Use the bottom navigation to switch between the Matrix, Command Control, and Intel views.',
          child: NavigationBar(
            height: 65,
            backgroundColor: const Color(0xFF030712),
            indicatorColor: accent.withOpacity(0.1),
            selectedIndex: _tabIndex,
            onDestinationSelected: (i) => setState(() => _tabIndex = i),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.grid_view_rounded, size: 20), label: 'HOME'),
              NavigationDestination(icon: Icon(Icons.bolt_rounded, size: 20), label: 'CONTROL'),
              NavigationDestination(icon: Icon(Icons.analytics_rounded, size: 20), label: 'INTEL'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppTitle() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'UNIFIED TERMINAL: ${widget.user['name']?.toUpperCase() ?? 'GUEST'}',
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white30, letterSpacing: 2),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: _state['simulationRunning'] == true ? Colors.green : Colors.red, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Text(
              'UPLINK: ${_state['simulationRunning'] == true ? 'ACTIVE' : 'PAUSED'} · ${_latency}ms'.toUpperCase(),
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 1),
            ),
          ],
        ),
      ],
    );
  }

}
