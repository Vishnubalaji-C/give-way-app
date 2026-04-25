import 'dart:async';
import 'package:flutter/material.dart';
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
    final lanes = (_state['lanes'] as Map<String, dynamic>?) ?? {};
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
      body: IndexedStack(
        index: _tabIndex,
        children: [
          _buildMatrixView(lanes, accent),
          _buildSensorStream(lanes, accent),
          _buildCommandCenter(lanes, accent),
          _buildIntelligence(accent),
        ],
      ),
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(canvasColor: const Color(0xFF030712)),
        child: Showcase(
          key: _keyNav,
          description: 'Use the bottom navigation to switch between the Matrix, Sensor Streams, Command Control, and Intel views.',
          child: NavigationBar(
            height: 65,
            backgroundColor: const Color(0xFF030712),
            indicatorColor: accent.withOpacity(0.1),
            selectedIndex: _tabIndex,
            onDestinationSelected: (i) => setState(() => _tabIndex = i),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.grid_view_rounded, size: 20), label: 'MATRIX'),
              NavigationDestination(icon: Icon(Icons.sensors_rounded, size: 20), label: 'STREAMS'),
              NavigationDestination(icon: Icon(Icons.bolt_rounded, size: 20), label: 'COMMAND'),
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

  Widget _buildMatrixView(Map<String, dynamic> lanes, Color accent) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildMissionBriefing(accent),
        const SizedBox(height: 24),
        Showcase(
          key: _keyMatrix,
          description: 'The Matrix view provides a live schematic of the current intersection and system stats.',
          child: Container(
            height: 200,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.01),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: JunctionSim(state: _state),
            ),
          ),
        ),
        const SizedBox(height: 24),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.5,
          children: [
            _statCard('TOTAL SERVED', '${_state['totalVehiclesServed'] ?? 0}', Colors.cyan),
            _statCard('AMBULANCES', '${_state['totalAmbulances'] ?? 0}', Colors.redAccent),
            _statCard('BUS PRIORITY', '${_state['totalBuses'] ?? 0}', Colors.purpleAccent),
            _statCard('SYSTEM TICK', '${_state['tick'] ?? 0}', Colors.white24),
          ],
        ),
        const SizedBox(height: 32),
        const Text('JUNCTION FEED MATRIX (ACTIVE)', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        ...lanes.entries.map((e) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: LaneCard(laneId: e.key, data: e.value),
        )),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildMissionBriefing(Color accent) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: accent.withOpacity(0.03),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: accent.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('SYSTEM OVERSIGHT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white30, letterSpacing: 2)),
          const SizedBox(height: 8),
          const Text('Metropolitan Infrastructure', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.5)),
          const SizedBox(height: 12),
          Row(
            children: [
              _statusChip('CORE: NOMINAL', Colors.green),
              const SizedBox(width: 8),
              _statusChip('MODE: ${_state['overrideMode']?.toUpperCase() ?? 'AUTO'}', accent),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSensorStream(Map<String, dynamic> lanes, Color accent) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('NODE ANALYTICS SCAN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 20),
        ...lanes.entries.map((entry) {
          final id = entry.key;
          final l = entry.value;
          final v = (l['vehicles'] as Map?) ?? {};
          final detected = v.values.fold<int>(0, (a, b) => a + (b as int));
          
          return Container(
            margin: const EdgeInsets.only(bottom: 24),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.02),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withOpacity(0.05)),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Text('APPROACH L-$id', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1)),
                      const Spacer(),
                      const Text('LIVE STREAM', style: TextStyle(color: Colors.white12, fontWeight: FontWeight.bold, fontSize: 9)),
                    ],
                  ),
                ),
                Container(
                  height: 160,
                  width: double.infinity,
                  color: Colors.black,
                  child: Center(
                    child: Text('LENS NODE SYNCING...'.toUpperCase(), style: const TextStyle(color: Colors.white10, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 5)),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _feedChip('TARGETS: $detected', Colors.white38),
                      _feedChip('PCE: ${(l['pceScore'] ?? 0).toStringAsFixed(0)}', accent),
                      _feedChip('WAIT: ${l['waitTime']}s', Colors.white12),
                    ],
                  ),
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildCommandCenter(Map<String, dynamic> lanes, Color accent) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('TACTICAL SIGNAL OVERRIDE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 20),
        ...lanes.entries.map((entry) {
          final id = entry.key;
          final l = entry.value;
          final signal = l['signal'] ?? 'red';
          
          return Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.02),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withOpacity(0.04)),
            ),
            child: Row(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: signal == 'green' ? Colors.green : signal == 'yellow' ? Colors.amber : Colors.red,
                    boxShadow: [
                       BoxShadow(color: (signal == 'green' ? Colors.green : signal == 'yellow' ? Colors.amber : Colors.red).withOpacity(0.5), blurRadius: 10)
                    ],
                  ),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('LANE $id', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1)),
                      Text('WAIT: ${l['waitTime']}s', style: const TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.bolt_rounded, color: Colors.green, size: 20),
                  onPressed: () => _ws.send('FORCE_GREEN', {'laneId': id}),
                ),
                IconButton(
                  icon: const Icon(Icons.block_rounded, color: Colors.red, size: 20),
                  onPressed: () => _ws.send('FORCE_RED', {'laneId': id}),
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 32),
        const Text('EXECUTION PROTOCOLS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        Showcase(
          key: _keyAction,
          description: 'Control traffic signal overrides and trigger execution protocols instantly.',
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _actionBtn('AUTO-PILOT', Icons.smart_toy_rounded, Colors.green, () => _ws.send('SET_OVERRIDE_MODE', {'mode': 'auto'})),
              _actionBtn('EMERGENCY', Icons.emergency_rounded, Colors.red, () => _ws.send('SET_OVERRIDE_MODE', {'mode': 'emergency'})),
              _actionBtn('GREEN WAVE', Icons.tsunami_rounded, Colors.cyan, () => _ws.send('TRIGGER_GREEN_WAVE')),
              _actionBtn('PEDESTRIAN', Icons.directions_walk_rounded, Colors.purpleAccent, () => _ws.send('REQUEST_PED_CROSSING')),
            ],
          ),
        ),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildIntelligence(Color accent) {
    if (_tabIndex != 3) return const SizedBox();
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('SECURITY & ANALYTICS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 24),
        AnalyticsCharts(analytics: _analytics),
        const SizedBox(height: 32),
        const Text('RECENT ALERT LOGS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        if (_alerts.isEmpty)
           const Center(child: Text('LOG BUFFER EMPTY', style: TextStyle(color: Colors.white10, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2)))
        else
          ..._alerts.take(10).map((a) => AlertTile(alert: a)),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 1)),
        ],
      ),
    );
  }

  Widget _actionBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.1)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 1)),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12), border: Border.all(color: color.withOpacity(0.2))),
      child: Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: color, letterSpacing: 1)),
    );
  }

  Widget _feedChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 8, letterSpacing: 1)),
    );
  }


}
