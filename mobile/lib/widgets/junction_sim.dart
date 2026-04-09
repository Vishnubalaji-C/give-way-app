import 'dart:math' as math;
import 'package:flutter/material.dart';

class JunctionSim extends StatelessWidget {
  final Map<String, dynamic> state;

  const JunctionSim({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 300,
      width: double.infinity,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF0F172A)
            : const Color(0xFFE2E8F0),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFF00E5FF).withOpacity(0.1),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            // Road Painter
            CustomPaint(
              size: Size.infinite,
              painter: _JunctionPainter(
                state: state,
                isDark: Theme.of(context).brightness == Brightness.dark,
              ),
            ),
            // Legend
            Positioned(
              top: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'LIVE SIMULATION',
                  style: TextStyle(
                    color: Color(0xFF00E5FF),
                    fontSize: 8,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _JunctionPainter extends CustomPainter {
  final Map<String, dynamic> state;
  final bool isDark;

  _JunctionPainter({required this.state, required this.isDark});

  @override
  void paint(Canvas canvas, Size size) {
    final centerX = size.width / 2;
    final centerY = size.height / 2;
    final roadWidth = 80.0;

    final roadPaint = Paint()
      ..color = isDark ? const Color(0xFF1E293B) : Colors.grey[400]!
      ..style = PaintingStyle.fill;

    final stripePaint = Paint()
      ..color = Colors.white.withOpacity(0.2)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    // Draw Roads (Vertical & Horizontal)
    canvas.drawRect(
      Rect.fromLTWH(centerX - roadWidth / 2, 0, roadWidth, size.height),
      roadPaint,
    );
    canvas.drawRect(
      Rect.fromLTWH(0, centerY - roadWidth / 2, size.width, roadWidth),
      roadPaint,
    );

    // Draw Stripes
    _drawDashLine(canvas, Offset(centerX, 0), Offset(centerX, size.height), stripePaint);
    _drawDashLine(canvas, Offset(0, centerY), Offset(size.width, centerY), stripePaint);

    // Draw Junction Center
    final centerPaint = Paint()
      ..color = isDark ? const Color(0xFF334155) : Colors.grey[300]!
      ..style = PaintingStyle.fill;
    canvas.drawRect(
      Rect.fromCenter(center: Offset(centerX, centerY), width: roadWidth, height: roadWidth),
      centerPaint,
    );

    // Draw Lane Signals and Vehicles
    final lanes = (state['lanes'] as Map<String, dynamic>?) ?? {};
    lanes.forEach((id, data) {
      _drawLaneDetails(canvas, id, data, centerX, centerY, roadWidth, size);
    });
  }

  void _drawLaneDetails(Canvas canvas, String id, Map<String, dynamic> data,
      double cx, double cy, double rw, Size size) {
    final signal = data['signal'] ?? 'red';
    final pce = (data['pceScore'] ?? 0) as num;
    
    // Signal Color
    Color signalColor = Colors.red;
    if (signal == 'green') signalColor = Colors.green;
    if (signal == 'yellow') signalColor = Colors.amber;

    final signalPaint = Paint()
      ..color = signalColor
      ..maskFilter = const MaskFilter.blur(BlurStyle.outer, 8);

    Offset signalPos;
    Offset vehicleStart;
    double dx = 0, dy = 0;

    switch (id) {
      case 'N':
        signalPos = Offset(cx - rw / 3, cy - rw / 1.5);
        vehicleStart = Offset(cx - rw / 4, 20);
        dy = 1;
        break;
      case 'S':
        signalPos = Offset(cx + rw / 3, cy + rw / 1.5);
        vehicleStart = Offset(cx + rw / 4, size.height - 20);
        dy = -1;
        break;
      case 'E':
        signalPos = Offset(cx + rw / 1.5, cy - rw / 3);
        vehicleStart = Offset(size.width - 20, cy - rw / 4);
        dx = -1;
        break;
      case 'W':
        signalPos = Offset(cx - rw / 1.5, cy + rw / 3);
        vehicleStart = Offset(20, cy + rw / 4);
        dx = 1;
        break;
      default:
        return;
    }

    // Draw Signal Light
    canvas.drawCircle(signalPos, 6, Paint()..color = signalColor);
    canvas.drawCircle(signalPos, 8, signalPaint);

    // Draw Vehicles (Represented as dots based on density for now)
    final vehicleCount = (pce / 10).clamp(0, 5).toInt();
    for (int i = 0; i < vehicleCount; i++) {
      final pos = Offset(
        vehicleStart.dx + (dx * i * 20),
        vehicleStart.dy + (dy * i * 20),
      );
      _drawVehicle(canvas, pos, id);
    }
  }

  void _drawVehicle(Canvas canvas, Offset pos, String laneId) {
    final paint = Paint()
      ..color = const Color(0xFF00E5FF)
      ..style = PaintingStyle.fill;
    
    // Draw a small car-like rectangle
    double w = 12, h = 18;
    if (laneId == 'E' || laneId == 'W') {
      w = 18; h = 12;
    }
    
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: pos, width: w, height: h),
        const Radius.circular(4),
      ),
      paint,
    );
  }

  void _drawDashLine(Canvas canvas, Offset start, Offset end, Paint paint) {
    double dashWidth = 10, dashSpace = 10, distance = 0;
    final totalDistance = (end - start).distance;
    final direction = (end - start) / totalDistance;

    while (distance < totalDistance) {
      canvas.drawLine(
        start + direction * distance,
        start + direction * math.min(distance + dashWidth, totalDistance),
        paint,
      );
      distance += dashWidth + dashSpace;
    }
  }

  @override
  bool shouldRepaint(covariant _JunctionPainter oldDelegate) =>
      oldDelegate.state != state || oldDelegate.isDark != isDark;
}
