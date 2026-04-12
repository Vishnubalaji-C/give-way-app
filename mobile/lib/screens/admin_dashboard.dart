import 'dart:async';
import 'package:flutter/material.dart';
import '../services/ws_service.dart';
import '../widgets/lane_card.dart';
import '../widgets/feature_badge.dart';
import '../widgets/alert_tile.dart';
import '../widgets/junction_sim.dart';
import '../widgets/analytics_charts.dart';
import '../services/api_service.dart';

class AdminDashboard extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  final VoidCallback onToggleTheme;
  final Function(String) onSwitchRole;

  const AdminDashboard({
    super.key,
    required this.user,
    required this.onLogout,
    required this.onToggleTheme,
    required this.onSwitchRole,
  });

  @override
  State<AdminDashboard> createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard> {
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
      if (mounted) {
        setState(() {
          _alerts.insert(0, a);
          if (_alerts.length > 50) _alerts.removeLast();
        });
      }
    });
    _latencyTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) {
        setState(() => _latency = 30 + (DateTime.now().millisecond % 50));
      }
    });
    _fetchAnalytics();
  }

  Future<void> _fetchAnalytics() async {
    try {
      final data = await ApiService.getAnalytics(widget.user['token']);
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

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFF020617),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'CENTRAL COMMAND CENTER',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white30, letterSpacing: 2),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(color: Color(0xFF00E5FF), shape: BoxShape.circle),
                ),
                const SizedBox(width: 8),
                Text(
                  'LINK: 172.18.99.1 · ${_latency}ms'.toUpperCase(),
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF00E5FF), letterSpacing: 1),
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
            icon: const Icon(Icons.security_rounded, color: Colors.white24, size: 20),
            onPressed: _showBroadcast,
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
          _buildGridView(lanes, isDark),
          _buildControlRoom(lanes, isDark),
          _buildAlerts(isDark),
          _buildAnalytics(isDark),
        ],
      ),
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(canvasColor: const Color(0xFF020617)),
        child: NavigationBar(
          height: 65,
          backgroundColor: const Color(0xFF020617),
          indicatorColor: const Color(0xFFFFB700).withOpacity(0.1),
          selectedIndex: _tabIndex,
          onDestinationSelected: (i) => setState(() => _tabIndex = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.monitor_rounded, size: 20), label: 'MATRIX'),
            NavigationDestination(icon: Icon(Icons.terminal_rounded, size: 20), label: 'OVERRIDE'),
            NavigationDestination(icon: Icon(Icons.hub_rounded, size: 20), label: 'NODES'),
            NavigationDestination(icon: Icon(Icons.analytics_rounded, size: 20), label: 'STATS'),
          ],
        ),
      ),
    );
  }

  Widget _buildGridView(Map<String, dynamic> lanes, bool isDark) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      children: [
        // Mission Briefing
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
                'UPLINK ACTIVE: ${widget.user['name']?.toUpperCase() ?? 'ADMIN'}',
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white30, letterSpacing: 2),
              ),
              const SizedBox(height: 8),
              const Text(
                'Infrastructure Oversight',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.5),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  _statusChip('SOLAR: 94%', const Color(0xFFFFB700)),
                  _statusChip('HW: NOMINAL', const Color(0xFF00FF88)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Spatial Simulation Card
        Container(
          height: 200,
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
        const SizedBox(height: 24),

        // High Level Stats
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.5,
          children: [
            _adminStat('TOTAL SERVED', '${_state['totalVehiclesServed'] ?? 0}', Colors.cyan),
            _adminStat('AMBULANCES', '${_state['totalAmbulances'] ?? 0}', Colors.redAccent),
            _adminStat('BUS PRIORITY', '${_state['totalBuses'] ?? 0}', Colors.purpleAccent),
            _adminStat('ACTIVE NODES', '${(_state['junction'] as Map?)?['cameraNodes'] ?? 0}', Colors.greenAccent),
          ],
        ),
        const SizedBox(height: 32),

        const Text('JUNCTION FEED MATRIX',
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

  Widget _buildControlRoom(Map<String, dynamic> lanes, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('TACTICAL SIGNAL OVERRIDE',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 20),
        ...lanes.entries.map((entry) {
          final id = entry.key;
          final l = entry.value;
          final signal = l['signal'] ?? 'red';
          final names = {'N': 'NORTH', 'S': 'SOUTH', 'E': 'EAST', 'W': 'WEST'};
          
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
                      Text('LANE $id: ${names[id]}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 1)),
                      const SizedBox(height: 4),
                      Text('LATENCY: ${l['waitTime'] ?? 0}s · PCE: ${(l['pceScore'] ?? 0).toStringAsFixed(0)}', style: const TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.bold)),
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
        
        const Text('SYSTEM EXECUTION MODES',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _actionTile('AUTO-PILOT', Icons.smart_toy_rounded, Colors.green, () => _ws.send('SET_OVERRIDE_MODE', {'mode': 'auto'})),
            _actionTile('EMERGENCY STOP', Icons.emergency_rounded, Colors.red, () => _ws.send('SET_OVERRIDE_MODE', {'mode': 'emergency'})),
            _actionTile('GREEN WAVE', Icons.tsunami_rounded, Colors.cyan, () => _ws.send('TRIGGER_GREEN_WAVE')),
            _actionTile('PED CROSSING', Icons.directions_walk_rounded, Colors.purpleAccent, () => _ws.send('REQUEST_PED_CROSSING')),
            _actionTile('STORM PROTOCOL', Icons.cloud_rounded, Colors.blue, () => _ws.send('SET_MODE', {'mode': 'rain', 'value': true})),
          ],
        ),
        const SizedBox(height: 32),
        
        const Text('ENGINE KERNEL CONTROL',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        Row(
          children: [
            _kernelBtn('START', Colors.green, () => _ws.send('START_SIM')),
            const SizedBox(width: 12),
            _kernelBtn('PAUSE', Colors.red, () => _ws.send('STOP_SIM')),
            const SizedBox(width: 12),
            _kernelBtn('RESET', Colors.white30, () => _ws.send('RESET_SIM')),
          ],
        ),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildAlerts(bool isDark) {
    return _alerts.isEmpty
        ? Center(
            child: Opacity(
              opacity: 0.1,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.notifications_off_rounded, size: 64, color: Colors.white24),
                  const SizedBox(height: 16),
                  const Text('ALERT BUFFER EMPTY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: 2, fontSize: 10)),
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
        const Text('METROPOLITAN INTELLIGENCE',
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 24),
        AnalyticsCharts(analytics: _analytics),
        const SizedBox(height: 32),
        _adminMetricTile('SYSTEM UPTIME', '100% NOMINAL', Icons.timer_rounded, Colors.greenAccent),
        _adminMetricTile('AI CALCULATIONS', '${_state['tick'] ?? 0} OPS', Icons.memory_rounded, Colors.purpleAccent),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _adminStat(String label, String value, Color color) {
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

  Widget _actionTile(String label, IconData icon, Color color, VoidCallback onTap) {
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

  Widget _kernelBtn(String label, Color color, VoidCallback onTap) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withOpacity(0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withOpacity(0.1)),
          ),
          child: Center(
            child: Text(label, style: TextStyle(color: color.withOpacity(0.8), fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 2)),
          ),
        ),
      ),
    );
  }

  Widget _adminMetricTile(String label, String value, IconData icon, Color color) {
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
              Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: color, letterSpacing: 1)),
    );
  }

  void _showBroadcast() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('🚨 EMERGENCY BROADCAST', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 2)),
        content: const Text(
            'This will trigger an All-Stop emergency protocol across all managed junctions. Access to this command is logged.',
            style: TextStyle(color: Colors.white60, fontSize: 12, height: 1.5)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('CANCEL', style: TextStyle(color: Colors.white24, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 2))),
          Padding(
            padding: const EdgeInsets.only(right: 8, bottom: 8),
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                _ws.send('SET_OVERRIDE_MODE', {'mode': 'emergency'});
                Navigator.pop(context);
              },
              child: const Text('ACTIVATE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 2)),
            ),
          ),
        ],
      ),
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
