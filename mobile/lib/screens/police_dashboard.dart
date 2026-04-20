import 'dart:async';
import 'package:flutter/material.dart';
import '../services/ws_service.dart';
import '../services/api_service.dart';
import '../widgets/lane_card.dart';
import '../widgets/feature_badge.dart';
import '../widgets/alert_tile.dart';
import '../widgets/junction_sim.dart';
import '../widgets/analytics_charts.dart';

class PoliceDashboard extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  final VoidCallback onToggleTheme;
  final Function(String) onSwitchRole;

  const PoliceDashboard({
    super.key,
    required this.user,
    required this.onLogout,
    required this.onToggleTheme,
    required this.onSwitchRole,
  });

  @override
  State<PoliceDashboard> createState() => _PoliceDashboardState();
}

class _PoliceDashboardState extends State<PoliceDashboard> {
  final WsService _ws = WsService();
  Map<String, dynamic> _state = {};
  Map<String, dynamic> _analytics = {};
  List<Map<String, dynamic>> _alerts = [];
  int _tabIndex = 0;
  Timer? _latencyTimer;
  int _latency = 0;

  @override
  void initState() {
    super.initState();
    _ws.connect();
    _ws.stateStream.listen((s) => setState(() => _state = s));
    _ws.alertStream.listen((a) {
      setState(() {
        _alerts.insert(0, a);
        if (_alerts.length > 30) _alerts.removeLast();
      });
    });
    _latencyTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      setState(() => _latency = 45 + (DateTime.now().millisecond % 45));
    });
    _fetchAnalytics();
  }

  Future<void> _fetchAnalytics() async {
    try {
      final data = await ApiService.getAnalytics();
      setState(() => _analytics = data);
    } catch (e) {
      debugPrint('Failed to fetch analytics: $e');
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = const Color(0xFF00E5FF);

    return Scaffold(
      backgroundColor: const Color(0xFF030712),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFF030712),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              ((_state['junction'] as Map<String, dynamic>?)?['name'] ?? 'TERMINAL GATEWAY').toUpperCase(),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 2),
            ),
            const SizedBox(height: 2),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(color: Color(0xFF00FF88), shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Text(
                  'SYNC: ${_latency}ms · LOCAL STREAM'.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 9,
                    color: Color(0xFF00E5FF),
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_search_rounded, color: Color(0xFF00E5FF), size: 20),
            onPressed: () => _showPersonaSwitcher(context),
            tooltip: 'Switch Persona',
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white30, size: 20),
            onPressed: widget.onLogout,
          ),
        ],
      ),
      body: IndexedStack(
        index: _tabIndex,
        children: [
          _buildHome(lanes, isDark),
          _buildCameraFeed(lanes, isDark),
          _buildAlerts(isDark),
          _buildAnalytics(isDark),
        ],
      ),
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(canvasColor: const Color(0xFF030712)),
        child: NavigationBar(
          height: 65,
          backgroundColor: const Color(0xFF030712),
          indicatorColor: const Color(0xFF00E5FF).withOpacity(0.1),
          selectedIndex: _tabIndex,
          onDestinationSelected: (i) => setState(() => _tabIndex = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.grid_view_rounded, size: 20), label: 'TACTICAL'),
            NavigationDestination(icon: Icon(Icons.sensors_rounded, size: 20), label: 'SENSORS'),
            NavigationDestination(icon: Icon(Icons.security_rounded, size: 20), label: 'SECURITY'),
            NavigationDestination(icon: Icon(Icons.analytics_rounded, size: 20), label: 'INTELLIGENCE'),
          ],
        ),
      ),
    );
  }

  Widget _buildHome(Map<String, dynamic> lanes, bool isDark) {
    final totalWait = lanes.values
        .fold<double>(0, (acc, l) => acc + ((l['waitTime'] ?? 0) as num));
    final avgWait = lanes.isNotEmpty ? (totalWait / 3) : 0;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      children: [
        // Cinematic Portal Greeting
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'UNIT READY: ${widget.user['name']?.toUpperCase() ?? 'OFFICER'}',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white30, letterSpacing: 2),
              ),
              const SizedBox(height: 8),
              const Text(
                'GiveWay ATES v4.2',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.5),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _locationChip('${(_state['junction'] as Map<String, dynamic>?)?['id'] ?? '---'} · ZONE-7'),
                  const SizedBox(width: 8),
                  _locationChip('LATERAL: ${avgWait.toStringAsFixed(1)}s', color: const Color(0xFFFFB700)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Grid Metrics
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.4,
          children: [
            _metricCard('AMBULANCE', '${_state['totalAmbulances'] ?? 0}', const Color(0xFFFF3B3B), Icons.emergency_rounded),
            _metricCard('BUS PRIORITY', '${_state['totalBuses'] ?? 0}', const Color(0xFF00E5FF), Icons.directions_bus_rounded),
            _metricCard('SYSTEM TICK', '${_state['tick'] ?? 0}', const Color(0xFF7C3AED), Icons.memory_rounded),
            _metricCard('ACTIVE NODES', '${(_state['junction'] as Map?)?['cameraNodes'] ?? 0}', const Color(0xFF00FF88), Icons.videocam_rounded),
          ],
        ),
        const SizedBox(height: 32),

        const Text('LANE FEED STATUS',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        ...lanes.entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: LaneCard(laneId: e.key, data: e.value),
            )),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildCameraFeed(Map<String, dynamic> lanes, bool isDark) {
    final junction = _state['junction'] as Map<String, dynamic>? ?? {};

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('SPATIAL JUNCTION TELEMETRY',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        Container(
          height: 240,
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: JunctionSim(state: _state),
          ),
        ),
        const SizedBox(height: 32),
        const Text('NODE ANALYTICS SCAN',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        ...lanes.entries.map((entry) {
          final id = entry.key;
          final l = entry.value;
          final v = (l['vehicles'] as Map<String, dynamic>?) ?? {};
          final detected = v.values.fold<int>(0, (a, b) => a + (b as int));
          final names = {'1': 'PRIMARY', '2': 'SECONDARY', '3': 'TRANSVERSE'};

          return Container(
            margin: const EdgeInsets.only(bottom: 20),
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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
                        child: Text(id, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w900, fontSize: 10)),
                      ),
                      const SizedBox(width: 12),
                      Text('${names[id] ?? 'AUX'} APPROACH', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 1)),
                      const Spacer(),
                      const Text('30 FPS', style: TextStyle(color: Colors.white12, fontWeight: FontWeight.bold, fontSize: 9)),
                    ],
                  ),
                ),
                Stack(
                  children: [
                    Container(
                      height: 160,
                      width: double.infinity,
                      color: Colors.black,
                      child: Center(
                        child: Text('LENS STREAM ${id}-0$detected'.toUpperCase(), style: const TextStyle(color: Colors.white10, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 5)),
                      ),
                    ),
                    // AUTOMATED LOCATION OVERLAY
                    Positioned(
                      top: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.8),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(junction['name']?.toUpperCase() ?? 'NULL NODE', style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900)),
                            const SizedBox(height: 2),
                            Text(junction['address'] ?? 'COORDINATING...', style: const TextStyle(color: Colors.white54, fontSize: 6, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Text('LAT: ${junction['lat']}', style: const TextStyle(color: Color(0xFF00E5FF), fontSize: 6, fontWeight: FontWeight.bold)),
                                const SizedBox(width: 8),
                                Text('LNG: ${junction['lng']}', style: const TextStyle(color: Color(0xFF00E5FF), fontSize: 6, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _feedChip('TARGETS: $detected', Colors.white38),
                      _feedChip('PCE: ${(l['pceScore'] ?? 0).toStringAsFixed(0)}', const Color(0xFF00E5FF)),
                      _feedChip('LATENCY: 12ms', Colors.white12),
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

  Widget _buildAlerts(bool isDark) {
    return _alerts.isEmpty
        ? Center(
            child: Opacity(
              opacity: 0.2,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shield_rounded, size: 64, color: Colors.white24),
                  const SizedBox(height: 16),
                  const Text('SECURITY STATUS: NOMINAL', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: 2, fontSize: 10)),
                ],
              ),
            ),
          )
        : ListView.builder(
            padding: const EdgeInsets.all(20),
            itemCount: _alerts.length,
            itemBuilder: (ctx, i) => AlertTile(alert: _alerts[i]),
          );
  }

  Widget _buildAnalytics(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('SYSTEM INTELLIGENCE MATRIX',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 24),
        _intelligenceTile('TOTAL THROUGHPUT', '${_state['totalVehiclesServed'] ?? 0}', Icons.trending_up_rounded, const Color(0xFF00E5FF)),
        _intelligenceTile('AMBULANCE SUCCESS', '${_state['totalAmbulances'] ?? 0}', Icons.emergency_rounded, const Color(0xFFFF3B3B)),
        _intelligenceTile('BUS PRIORITIZATION', '${_state['totalBuses'] ?? 0}', Icons.directions_bus_rounded, const Color(0xFF7C3AED)),
        _intelligenceTile('EMISSIONS REDUCTION', '${(_state['fuelSaved'] ?? 0).toStringAsFixed(1)}L', Icons.eco_rounded, const Color(0xFF00FF88)),
        const SizedBox(height: 32),
        _analytics.isEmpty
            ? const Center(child: Padding(
                padding: EdgeInsets.all(32),
                child: Column(
                  children: [
                    CircularProgressIndicator(color: Color(0xFF00E5FF), strokeWidth: 1.5),
                    SizedBox(height: 16),
                    Text('LOADING INTELLIGENCE...', style: TextStyle(color: Colors.white24, fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 2)),
                  ],
                ),
              ))
            : AnalyticsCharts(analytics: _analytics),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _metricCard(String label, String value, Color color, IconData icon) {
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
          Icon(icon, color: color.withOpacity(0.4), size: 18),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: color)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 1)),
        ],
      ),
    );
  }

  Widget _intelligenceTile(String label, String value, IconData icon, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 1)),
              const SizedBox(height: 2),
              Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: color)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _locationChip(String label, {Color color = Colors.white24}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color.withOpacity(0.8), letterSpacing: 1),
      ),
    );
  }

  Widget _feedChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.05), borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 8, letterSpacing: 1)),
    );
  }

  void _showPersonaSwitcher(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (ctx) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('PERSONA REDIRECTION', style: TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
            const SizedBox(height: 16),
            const Text('Switch System Context', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 24),
            _personaTile(ctx, 'System Administrator', 'admin', Icons.admin_panel_settings_rounded, const Color(0xFFFFB700)),
            const SizedBox(height: 12),
            _personaTile(ctx, 'Police Field Officer', 'police', Icons.local_police_rounded, const Color(0xFF00E5FF)),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _personaTile(BuildContext context, String title, String role, IconData icon, Color color) {
    final isSelected = widget.user['role'] == role;
    return InkWell(
      onTap: isSelected ? null : () {
        Navigator.pop(context);
        widget.onSwitchRole(role);
      },
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.1) : Colors.white.withOpacity(0.02),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: isSelected ? color.withOpacity(0.3) : Colors.white.withOpacity(0.05)),
        ),
        child: Row(
          children: [
            Icon(icon, color: isSelected ? color : Colors.white24, size: 24),
            const SizedBox(width: 16),
            Expanded(
              child: Text(title, style: TextStyle(color: isSelected ? Colors.white : Colors.white54, fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            if (isSelected) Icon(Icons.check_circle_rounded, color: color, size: 20),
          ],
        ),
      ),
    );
  }
}
