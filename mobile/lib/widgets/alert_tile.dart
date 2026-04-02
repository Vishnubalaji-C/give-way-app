import 'package:flutter/material.dart';

class AlertTile extends StatelessWidget {
  final Map<String, dynamic> alert;

  const AlertTile({super.key, required this.alert});

  @override
  Widget build(BuildContext context) {
    final type = alert['type'] ?? 'info';
    final message = alert['message'] ?? '';
    final timestamp = alert['timestamp'] ?? 0;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color bgColor;
    Color borderColor;
    Color textColor;

    switch (type) {
      case 'emergency':
        bgColor = Colors.red.withOpacity(0.1);
        borderColor = Colors.red.withOpacity(0.25);
        textColor = Colors.redAccent;
        break;
      case 'breakdown':
        bgColor = Colors.orange.withOpacity(0.1);
        borderColor = Colors.orange.withOpacity(0.25);
        textColor = Colors.orangeAccent;
        break;
      case 'ghost':
        bgColor = Colors.purple.withOpacity(0.1);
        borderColor = Colors.purple.withOpacity(0.25);
        textColor = Colors.purpleAccent;
        break;
      case 'warning':
        bgColor = Colors.amber.withOpacity(0.1);
        borderColor = Colors.amber.withOpacity(0.25);
        textColor = Colors.amberAccent;
        break;
      default:
        bgColor = isDark
            ? Colors.white.withOpacity(0.03)
            : Colors.grey.withOpacity(0.08);
        borderColor = Colors.white10;
        textColor = isDark ? Colors.white70 : Colors.black87;
    }

    final time = DateTime.fromMillisecondsSinceEpoch(timestamp);
    final timeStr =
        '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:${time.second.toString().padLeft(2, '0')}';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(timeStr,
              style: TextStyle(
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: Colors.grey[600])),
          const SizedBox(height: 4),
          Text(message,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight:
                      type == 'emergency' ? FontWeight.w800 : FontWeight.w500,
                  color: textColor)),
        ],
      ),
    );
  }
}
