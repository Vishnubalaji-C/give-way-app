import 'package:flutter/material.dart';
import '../services/ws_service.dart';

class CommandScreen extends StatelessWidget {
  final Map<String, dynamic> state;
  final List<Map<String, dynamic>> alerts;
  final WsService ws;

  const CommandScreen({
    super.key,
    required this.state,
    required this.alerts,
    required this.ws,
  });

  @override
  Widget build(BuildContext context) {
    final lanes = (state['lanes'] as Map<String, dynamic>?) ?? {};
    const accent = Color(0xFF00E5FF);

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
                  onPressed: () => ws.send('FORCE_GREEN', {'laneId': id}),
                ),
                IconButton(
                  icon: const Icon(Icons.block_rounded, color: Colors.red, size: 20),
                  onPressed: () => ws.send('FORCE_RED', {'laneId': id}),
                ),
              ],
            ),
          );
        }),
        const SizedBox(height: 32),
        const Text('EXECUTION PROTOCOLS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _actionBtn('AUTO-PILOT', Icons.smart_toy_rounded, Colors.green, () => ws.send('SET_OVERRIDE_MODE', {'mode': 'auto'})),
            _actionBtn('EMERGENCY', Icons.emergency_rounded, Colors.red, () => ws.send('SET_OVERRIDE_MODE', {'mode': 'emergency'})),
            _actionBtn('GREEN WAVE', Icons.tsunami_rounded, Colors.cyan, () => ws.send('TRIGGER_GREEN_WAVE')),
            _actionBtn('PEDESTRIAN', Icons.directions_walk_rounded, Colors.purpleAccent, () => ws.send('REQUEST_PED_CROSSING')),
            _actionBtn('GHOST TEST', Icons.visibility_off_rounded, Colors.amber, () => ws.send('SIMULATE_GHOST')),
          ],
        ),
        const SizedBox(height: 40),
        const Text('RECENT AUDIT LOG', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        if (alerts.isEmpty)
           const Center(child: Text('LOG BUFFER EMPTY', style: TextStyle(color: Colors.white10, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2)))
        else
          ...alerts.take(15).map((a) => _buildAuditEntry(a)),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildAuditEntry(Map<String, dynamic> a) {
    final type = a['type'] ?? 'info';
    final color = type == 'emergency' ? Colors.redAccent : type == 'warning' ? Colors.amber : Colors.cyanAccent;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _formatTime(a['timestamp']),
            style: const TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()]),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              a['message'] ?? '',
              style: TextStyle(color: color.withOpacity(0.8), fontSize: 11, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(dynamic ts) {
    if (ts == null) return '--:--';
    final dt = DateTime.fromMillisecondsSinceEpoch(ts is int ? ts : int.parse(ts.toString()));
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
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
}
