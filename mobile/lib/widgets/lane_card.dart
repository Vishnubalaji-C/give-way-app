import 'package:flutter/material.dart';

class LaneCard extends StatelessWidget {
  final String laneId;
  final Map<String, dynamic> data;

  const LaneCard({super.key, required this.laneId, required this.data});

  @override
  Widget build(BuildContext context) {
    final signal = data['signal'] ?? 'red';
    final density = (data['density'] ?? 0).toDouble();
    final waitTime = data['waitTime'] ?? 0;
    final ghostFlag = data['ghostFlag'] ?? false;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final names = {'1': 'SOUTH APP', '2': 'EAST APP', '3': 'WEST APP', 'N': 'NORTH', 'S': 'SOUTH', 'E': 'EAST', 'W': 'WEST'};

    final signalColor = signal == 'green'
        ? Colors.green
        : signal == 'yellow'
            ? Colors.amber
            : Colors.red;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F1923) : Colors.grey[100],
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: ghostFlag
              ? Colors.purple.withOpacity(0.4)
              : signalColor.withOpacity(0.15),
        ),
      ),
      child: Row(
        children: [
          // Signal Light
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: signalColor,
              boxShadow: [
                BoxShadow(
                    color: signalColor.withOpacity(0.6), blurRadius: 10),
              ],
            ),
          ),
          const SizedBox(width: 12),

          // Lane Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('LANE $laneId',
                        style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontFamily: 'monospace',
                            fontSize: 13)),
                    const SizedBox(width: 6),
                    Text('${names[laneId]}',
                        style: TextStyle(
                            fontSize: 10, color: Colors.grey[500])),
                    if (ghostFlag) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.purple.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text('👻 GHOST',
                            style: TextStyle(
                                fontSize: 8,
                                fontWeight: FontWeight.w900,
                                color: Colors.purpleAccent)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                // Density bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (density / 100).clamp(0, 1),
                    minHeight: 6,
                    backgroundColor: isDark
                        ? Colors.white.withOpacity(0.05)
                        : Colors.grey[300],
                    valueColor: AlwaysStoppedAnimation(
                      signal == 'green'
                          ? const Color(0xFF00FF88)
                          : Colors.grey[600]!,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),

          // Stats
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('${density.toStringAsFixed(0)}',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: signal == 'green'
                          ? const Color(0xFF00FF88)
                          : Colors.grey[500])),
              Text('${waitTime}s wait',
                  style: TextStyle(fontSize: 10, color: Colors.grey[600])),
            ],
          ),
        ],
      ),
    );
  }
}
