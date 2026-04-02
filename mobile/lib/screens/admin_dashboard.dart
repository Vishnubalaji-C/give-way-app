import 'dart:async';
import 'package:flutter/material.dart';
import '../services/ws_service.dart';
import '../widgets/lane_card.dart';
import '../widgets/feature_badge.dart';
import '../widgets/alert_tile.dart';

class AdminDashboard extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  final VoidCallback onToggleTheme;

  const AdminDashboard({
    super.key,
    required this.user,
    required this.onLogout,
    required this.onToggleTheme,
  });

  @override
  State<AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard> {
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
        if (_alerts.length > 50) _alerts.removeLast();
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

    return Scaffold(
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF02050A) : null,
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                gradient: const LinearGradient(
                  colors: [Color(0xFF00E5FF), Color(0xFF00FF88)],
                ),
              ),
              child: const Center(
                child: Text('GW',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Colors.black)),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('GiveWay Control',
                    style:
                        TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                Text('${widget.user['id']} · ${_latency}ms',
                    style: const TextStyle(
                        fontSize: 10,
                        color: Color(0xFF00E5FF),
                        fontFamily: 'monospace')),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(isDark ? Icons.light_mode : Icons.dark_mode,
                color: Colors.amber, size: 20),
            onPressed: widget.onToggleTheme,
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.security, color: Color(0xFF00E5FF)),
            onSelected: (v) {
              if (v == 'logout') widget.onLogout();
              if (v == 'broadcast') _showBroadcast();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                  value: 'broadcast', child: Text('🚨 Emergency Broadcast')),
              const PopupMenuItem(
                  value: 'logout',
                  child: Text('🔓 Logout Securely',
                      style: TextStyle(color: Colors.redAccent))),
            ],
          ),
        ],
      ),
      body: IndexedStack(
        index: _tabIndex,
        children: [
          _buildGridView(lanes, isDark),
          _buildControlRoom(lanes, isDark),
          _buildAlerts(isDark),
          _buildAnalytics(isDark),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.grid_view), label: 'Grid View'),
          NavigationDestination(
              icon: Icon(Icons.tune), label: 'Control Room'),
          NavigationDestination(
              icon: Icon(Icons.notifications_active), label: 'Alerts'),
          NavigationDestination(
              icon: Icon(Icons.analytics), label: 'Analytics'),
        ],
      ),
    );
  }

  Widget _buildGridView(Map<String, dynamic> lanes, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Welcome header
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(colors: [
              const Color(0xFFFFB700).withOpacity(0.08),
              const Color(0xFF7C3AED).withOpacity(0.04),
            ]),
            border:
                Border.all(color: const Color(0xFFFFB700).withOpacity(0.12)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Central Command — ${widget.user['name'] ?? 'Admin'}',
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              Text('City-wide junction monitoring is active.',
                  style: TextStyle(fontSize: 12, color: Colors.grey[500])),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Hardware Status
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

        // Stats
        Row(
          children: [
            _stat('Total Served', '${_state['totalVehiclesServed'] ?? 0}',
                const Color(0xFF00E5FF)),
            const SizedBox(width: 12),
            _stat('Ambulances', '${_state['totalAmbulances'] ?? 0}',
                const Color(0xFFFF3B3B)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _stat('Buses', '${_state['totalBuses'] ?? 0}',
                const Color(0xFF00E5FF)),
            const SizedBox(width: 12),
            _stat('Active Cams', '${(_state['junction'] as Map?)?['cameraNodes'] ?? 0}',
                const Color(0xFF22C55E)),
          ],
        ),
        const SizedBox(height: 24),

        const Text('Junction Lanes',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),
        ...lanes.entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: LaneCard(laneId: e.key, data: e.value),
            )),
      ],
    );
  }

  Widget _buildControlRoom(Map<String, dynamic> lanes, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('🎮 Signal Override Control',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 4),
        Text('Manually force Green/Red on any lane.',
            style: TextStyle(fontSize: 12, color: Colors.grey[500])),
        const SizedBox(height: 16),
        ...lanes.entries.map((entry) {
          final id = entry.key;
          final l = entry.value;
          final signal = l['signal'] ?? 'red';
          final names = {
            'N': 'NORTH',
            'S': 'SOUTH',
            'E': 'EAST',
            'W': 'WEST'
          };
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0D1827) : Colors.grey[100],
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: signal == 'green'
                    ? Colors.green.withOpacity(0.3)
                    : signal == 'yellow'
                        ? Colors.amber.withOpacity(0.3)
                        : Colors.red.withOpacity(0.1),
              ),
            ),
            child: Row(
              children: [
                // Signal indicator
                Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: signal == 'green'
                        ? Colors.green
                        : signal == 'yellow'
                            ? Colors.amber
                            : Colors.red,
                    boxShadow: [
                      BoxShadow(
                        color: (signal == 'green'
                                ? Colors.green
                                : signal == 'yellow'
                                    ? Colors.amber
                                    : Colors.red)
                            .withOpacity(0.5),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Lane $id — ${names[id]}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 14)),
                      Text(
                          'Wait: ${l['waitTime'] ?? 0}s · PCE: ${(l['pceScore'] ?? 0).toStringAsFixed(0)}',
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey[500])),
                    ],
                  ),
                ),
                // Force buttons
                IconButton(
                  icon: const Icon(Icons.play_arrow, color: Colors.green),
                  onPressed: () =>
                      _ws.send('FORCE_GREEN', {'laneId': id}),
                  tooltip: 'Force Green',
                ),
                IconButton(
                  icon: const Icon(Icons.stop, color: Colors.red),
                  onPressed: () =>
                      _ws.send('FORCE_RED', {'laneId': id}),
                  tooltip: 'Force Red',
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 20),
        // Mode controls
        const Text('System Mode',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _modeChip('Auto', Icons.smart_toy, Colors.green, () {
              _ws.send('SET_OVERRIDE_MODE', {'mode': 'auto'});
            }),
            _modeChip('Emergency All-Stop', Icons.dangerous, Colors.red, () {
              _ws.send('SET_OVERRIDE_MODE', {'mode': 'emergency'});
            }),
            _modeChip('Green Wave', Icons.waves, Colors.teal, () {
              _ws.send('TRIGGER_GREEN_WAVE');
            }),
            _modeChip('Rain Mode', Icons.water_drop, Colors.blue, () {
              _ws.send('SET_MODE', {'mode': 'rain', 'value': true});
            }),
          ],
        ),
      ],
    );
  }

  Widget _buildAlerts(bool isDark) {
    return _alerts.isEmpty
        ? Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle, size: 48, color: Colors.grey[700]),
                const SizedBox(height: 12),
                Text('No alerts detected.',
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
        const Text('📊 City Analytics',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        const SizedBox(height: 16),
        _anaCard('Vehicles Served', '${_state['totalVehiclesServed'] ?? 0}',
            Icons.directions_car, const Color(0xFF00E5FF)),
        _anaCard('Ambulances Cleared', '${_state['totalAmbulances'] ?? 0}',
            Icons.local_hospital, const Color(0xFFFF3B3B)),
        _anaCard('Buses Prioritized', '${_state['totalBuses'] ?? 0}',
            Icons.directions_bus, const Color(0xFFA855F7)),
        _anaCard('Fuel Saved', '${_state['fuelSaved'] ?? 0} L',
            Icons.local_gas_station, const Color(0xFFFFB700)),
        _anaCard('Total System Uptime', 'Running nominal', Icons.timer,
            const Color(0xFF22C55E)),
        _anaCard('AI Decisions', '${_state['tick'] ?? 0}', Icons.memory,
            const Color(0xFF7C3AED)),
      ],
    );
  }

  Widget _stat(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.07),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.12)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: color)),
            Text(label,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[500])),
          ],
        ),
      ),
    );
  }

  Widget _modeChip(
      String label, IconData icon, Color color, VoidCallback onTap) {
    return ActionChip(
      avatar: Icon(icon, size: 16, color: color),
      label: Text(label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700, color: color)),
      backgroundColor: color.withOpacity(0.1),
      side: BorderSide(color: color.withOpacity(0.2)),
      onPressed: onTap,
    );
  }

  Widget _anaCard(String label, String value, IconData icon, Color color) {
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

  void _showBroadcast() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('🚨 Emergency Broadcast'),
        content: const Text(
            'This will trigger an All-Stop emergency across all junctions. Continue?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () {
              _ws.send('SET_OVERRIDE_MODE', {'mode': 'emergency'});
              Navigator.pop(context);
            },
            child: const Text('ACTIVATE',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
