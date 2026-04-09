import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

class AnalyticsCharts extends StatelessWidget {
  final Map<String, dynamic> analytics;

  const AnalyticsCharts({super.key, required this.analytics});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Traffic Throughput (Hourly)',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 200,
          child: LineChart(
            LineChartData(
              gridData: const FlGridData(show: false),
              titlesData: const FlTitlesData(show: false),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots: _generateSpots(),
                  isCurved: true,
                  color: const Color(0xFF00E5FF),
                  barWidth: 4,
                  isStrokeCapRound: true,
                  dotData: const FlDotData(show: false),
                  belowBarData: BarAreaData(
                    show: true,
                    color: const Color(0xFF00E5FF).withOpacity(0.1),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 32),
        const Text(
          'Vehicle Distribution Mix',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 200,
          child: BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              maxY: 100,
              barTouchData: BarTouchData(enabled: false),
              titlesData: const FlTitlesData(show: false),
              gridData: const FlGridData(show: false),
              borderData: FlBorderData(show: false),
              barGroups: _generateBarGroups(isDark),
            ),
          ),
        ),
      ],
    );
  }

  List<FlSpot> _generateSpots() {
    // Dummy progression if hourly data isn't ready, otherwise map from analytics
    final hourly = (analytics['hourly'] as List?) ?? [];
    if (hourly.isEmpty) {
      return const [
        FlSpot(0, 20),
        FlSpot(1, 45),
        FlSpot(2, 30),
        FlSpot(3, 85),
        FlSpot(4, 55),
        FlSpot(5, 70),
      ];
    }
    return hourly.asMap().entries.map((e) {
      return FlSpot(e.key.toDouble(), (e.value['throughput'] ?? 0).toDouble());
    }).toList();
  }

  List<BarChartGroupData> _generateBarGroups(bool isDark) {
    final mix = (analytics['vehicleMix'] as Map?) ?? {};
    final labels = ['Ambulance', 'Bus', 'Car', 'Bike'];
    final colors = [
      Colors.redAccent,
      const Color(0xFFA855F7),
      const Color(0xFF00E5FF),
      const Color(0xFF22C55E)
    ];

    return List.generate(4, (i) {
      final key = labels[i].toLowerCase();
      final val = (mix[key] ?? 10).toDouble();
      return BarChartGroupData(
        x: i,
        barRods: [
          BarChartRodData(
            toY: val,
            color: colors[i],
            width: 16,
            borderRadius: BorderRadius.circular(4),
          ),
        ],
      );
    });
  }
}
