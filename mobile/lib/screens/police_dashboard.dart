import 'dart:async';
import 'package:flutter/material.dart';
import '../services/ws_service.dart';
import '../services/api_service.dart';
import '../widgets/lane_card.dart';
import '../widgets/feature_badge.dart';
import '../widgets/alert_tile.dart';

class PoliceDashboard extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  final VoidCallback onToggleTheme;

  const PoliceDashboard({
    super.key,
    required this.user,
    required this.onLogout,
    required this.onToggleTheme,
  });

  @override
  State<PoliceDashboard> createState() => _PoliceDashboardState();
}

class _PoliceDashboardState extends State<PoliceDashboard> {
  final WsService _ws = WsService();
  Map<String, dynamic> _state = {};
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
      setState(() => _latency = 45 + (DateTime.now().millisecond % 105));
    });
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
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF02050A) : null,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${widget.user['name'] ?? 'Officer'}',
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w900)),
            Text('Latency: ${_latency}ms',
                style: TextStyle(
                    fontSize: 10,
                    color: accent,
                    fontFamily: 'monospace')),
          ],
        ),
        leading: Padding(
          padding: const EdgeInsets.all(8),
          child: CircleAvatar(
            backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.grey[200],
            child: const Icon(Icons.person, size: 20),
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode,
                color: Colors.amber, size: 20),
            onPressed: widget.onToggleTheme,
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent, size: 20),
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.videocam), label: 'Live Feed'),
          NavigationDestination(icon: Icon(Icons.warning_amber), label: 'Alerts'),
          NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Analytics'),
        ],
      ),
    );
  }

  Widget _buildHome(Map<String, dynamic> lanes, bool isDark) {
    final totalWait = lanes.values
        .fold<double>(0, (acc, l) => acc + ((l['waitTime'] ?? 0) as num));
    final avgWait = lanes.isNotEmpty ? (totalWait / lanes.length) : 0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Greeting
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              colors: [
                const Color(0xFF00E5FF).withOpacity(0.1),
                const Color(0xFF7C3AED).withOpacity(0.05),
              ],
            ),
            border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.15)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome, ${widget.user['name'] ?? 'Officer'}',
                style: const TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              Text(
                'AI infrastructure is functioning optimally.',
                style: TextStyle(fontSize: 13, color: Colors.grey[500]),
              ),
              const SizedBox(height: 14),
              Text('Avg Wait: ${avgWait.toStringAsFixed(1)}s',
                  style: const TextStyle(
                      color: Color(0xFFFFB700),
                      fontWeight: FontWeight.w800,
                      fontSize: 16)),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Hardware Feature Badges
        const Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FeatureBadge(label: 'SOLAR-ECO', color: Color(0xFFFFB700)),
            FeatureBadge(label: 'PED RADAR', color: Color(0xFF00E5FF)),
            FeatureBadge(label: 'BUZZER ARM', color: Color(0xFFFF3B3B)),
            FeatureBadge(label: 'STALL-AI', color: Color(0xFF00FF88)),
          ],
        ),
        const SizedBox(height: 16),

        // Stats Row
        Row(
          children: [
            _statCard('Ambulances', '${_state['totalAmbulances'] ?? 0}',
                const Color(0xFFFF3B3B)),
            const SizedBox(width: 12),
            _statCard('AI Decisions', '${_state['tick'] ?? 0}',
                const Color(0xFF7C3AED)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _statCard('Buses', '${_state['totalBuses'] ?? 0}',
                const Color(0xFF00E5FF)),
            const SizedBox(width: 12),
            _statCard('CO₂ Saved', '${_state['co2Reduced'] ?? 0} kg',
                const Color(0xFF00FF88)),
          ],
        ),
        const SizedBox(height: 20),

        // Lane Densities
        const Text('Live Lane Densities',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),
        ...lanes.entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: LaneCard(laneId: e.key, data: e.value),
            )),
      ],
    );
  }

  Widget _buildCameraFeed(Map<String, dynamic> lanes, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('📷 Live Hardware Feed',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        Text('ESP32-CAM edge inference. YOLOv8 → 1KB JSON density.',
            style: TextStyle(fontSize: 12, color: Colors.grey[500])),
        const SizedBox(height: 16),
        ...lanes.entries.map((entry) {
          final id = entry.key;
          final l = entry.value;
          final v = (l['vehicles'] as Map<String, dynamic>?) ?? {};
          final detected = v.values.fold<int>(0, (a, b) => a + (b as int));
          final names = {'N': 'NORTH', 'S': 'SOUTH', 'E': 'EAST', 'W': 'WEST'};

          return Container(
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0D1827) : Colors.grey[100],
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                  color: const Color(0xFF00E5FF).withOpacity(0.1)),
            ),
            child: Column(
              children: [
                // Camera header
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0F1923) : Colors.grey[200],
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(18)),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 12,
                        backgroundColor: const Color(0xFF1E293B),
                        child: Text(id,
                            style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                color: Colors.white70)),
                      ),
                      const SizedBox(width: 8),
                      Text('${names[id]} NODE',
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w800)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.green.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                              color: Colors.green.withOpacity(0.3)),
                        ),
                        child: const Text('● REC',
                            style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: Colors.green)),
                      ),
                    ],
                  ),
                ),
                // Simulated feed area
                Container(
                  height: 140,
                  width: double.infinity,
                  color: const Color(0xFF0B101C),
                  child: Stack(
                    children: [
                      // Road visual
                      Center(
                        child: Container(
                          width: 100,
                          height: 140,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                Colors.white.withOpacity(0.03),
                              ],
                            ),
                          ),
                        ),
                      ),
                      // Detection boxes
                      ...List.generate(detected.clamp(0, 6), (i) {
                        final types = v.entries.toList();
                        final boxColors = {
                          'ambulance': Colors.red,
                          'bus': Colors.cyan,
                          'car': Colors.green,
                          'bike': Colors.purple,
                        };
                        String type = 'car';
                        for (var t in types) {
                          if ((t.value as int) > 0) {
                            type = t.key;
                            break;
                          }
                        }
                        return Positioned(
                          left: 20.0 + (i * 45) % 200,
                          top: 20.0 + (i * 30) % 80,
                          child: Container(
                            width: type == 'bus' ? 40 : 28,
                            height: type == 'bus' ? 50 : 32,
                            decoration: BoxDecoration(
                              border: Border.all(
                                  color: boxColors[type] ?? Colors.green,
                                  width: 2),
                              boxShadow: [
                                BoxShadow(
                                  color: (boxColors[type] ?? Colors.green)
                                      .withOpacity(0.3),
                                  blurRadius: 8,
                                ),
                              ],
                            ),
                            child: Align(
                              alignment: Alignment.topLeft,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 2, vertical: 1),
                                color: Colors.black54,
                                child: Text(type.toUpperCase(),
                                    style: const TextStyle(
                                        fontSize: 6,
                                        color: Colors.white,
                                        fontFamily: 'monospace')),
                              ),
                            ),
                          ),
                        );
                      }),
                      if (detected == 0)
                        const Center(
                          child: Text('NO TARGETS',
                              style: TextStyle(
                                  color: Colors.white24,
                                  fontSize: 10,
                                  fontFamily: 'monospace')),
                        ),
                    ],
                  ),
                ),
                // Footer stats
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  child: Row(
                    children: [
                      _feedStat('Detected', '$detected'),
                      const SizedBox(width: 20),
                      _feedStat('PCE Score',
                          '${(l['pceScore'] ?? 0).toStringAsFixed(0)}',
                          color: const Color(0xFF00E5FF)),
                      const SizedBox(width: 20),
                      _feedStat('Payload', '1 KB'),
                    ],
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildAlerts(bool isDark) {
    return _alerts.isEmpty
        ? Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle_outline,
                    size: 48, color: Colors.green.withOpacity(0.3)),
                const SizedBox(height: 12),
                Text('All Systems Nominal',
                    style: TextStyle(color: Colors.grey[600])),
              ],
            ),
          )
        : ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: _alerts.length,
            itemBuilder: (ctx, i) => AlertTile(alert: _alerts[i]),
          );
  }

  Widget _buildAnalytics(bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('📊 System Analytics',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 16),
        _analyticsCard('Total Vehicles Served',
            '${_state['totalVehiclesServed'] ?? 0}', Icons.directions_car,
            const Color(0xFF00E5FF)),
        _analyticsCard('Ambulances Cleared',
            '${_state['totalAmbulances'] ?? 0}', Icons.local_hospital,
            const Color(0xFFFF3B3B)),
        _analyticsCard('Buses Prioritized', '${_state['totalBuses'] ?? 0}',
            Icons.directions_bus, const Color(0xFF7C3AED)),
        _analyticsCard('Fuel Saved', '${_state['fuelSaved'] ?? 0} L',
            Icons.local_gas_station, const Color(0xFFFFB700)),
        _analyticsCard('CO₂ Reduced', '${_state['co2Reduced'] ?? 0} kg',
            Icons.eco, const Color(0xFF00FF88)),
        _analyticsCard('AI Compute Ticks', '${_state['tick'] ?? 0}',
            Icons.memory, const Color(0xFFA855F7)),
      ],
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.15)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: color)),
            const SizedBox(height: 4),
            Text(label,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey[500])),
          ],
        ),
      ),
    );
  }

  Widget _feedStat(String label, String value, {Color? color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 9,
                color: Colors.grey[600],
                fontFamily: 'monospace')),
        Text(value,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: color ?? Colors.white70)),
      ],
    );
  }

  Widget _analyticsCard(
      String label, String value, IconData icon, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.12)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value,
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: color)),
              Text(label,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[500])),
            ],
          ),
        ],
      ),
    );
  }
}
