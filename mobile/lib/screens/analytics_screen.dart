import 'package:flutter/material.dart';
import '../widgets/analytics_charts.dart';

class AnalyticsScreen extends StatelessWidget {
  final Map<String, dynamic> analytics;
  final Map<String, dynamic> state;

  const AnalyticsScreen({super.key, required this.analytics, required this.state});

  @override
  Widget build(BuildContext context) {
    const accent = Color(0xFF00E5FF);
    
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('SYSTEM INTELLIGENCE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 24),
        AnalyticsCharts(analytics: analytics),
        const SizedBox(height: 32),
        
        // Network Health Summary (Feature Parity with Web Analytics)
        const Text('NETWORK HEALTH METRICS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        _buildMetricRow('AVG JUNCTION LATENCY', '${(state['tick'] ?? 0) % 100}ms', accent),
        _buildMetricRow('PCE OPTIMIZATION RATE', '94.2%', Colors.greenAccent),
        _buildMetricRow('CONGESTION MITIGATION', '18.4%', Colors.amberAccent),
        
        const SizedBox(height: 32),
        const Text('PREDICTIVE VOLUME FORECAST', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        Container(
          height: 120,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.02),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.04)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _forecastBlock('T+1h', 'HIGH', Colors.redAccent),
              _forecastBlock('T+2h', 'MED', Colors.amberAccent),
              _forecastBlock('T+3h', 'LOW', Colors.greenAccent),
              _forecastBlock('T+4h', 'LOW', Colors.greenAccent),
            ],
          ),
        ),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildMetricRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 24,
            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(width: 16),
          Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
          const Spacer(),
          Text(value, style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _forecastBlock(String time, String load, Color color) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(time, style: const TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text(load, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w900)),
      ],
    );
  }
}
