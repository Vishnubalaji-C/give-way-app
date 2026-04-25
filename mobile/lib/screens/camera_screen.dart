import 'package:flutter/material.dart';

class CameraScreen extends StatefulWidget {
  final Map<String, dynamic> state;

  const CameraScreen({super.key, required this.state});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  String _selectedLane = '1';

  @override
  Widget build(BuildContext context) {
    final lanes = (widget.state['lanes'] as Map<String, dynamic>?) ?? {};
    final l = lanes[_selectedLane] ?? {};
    const accent = Color(0xFF00E5FF);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('AI VISION TERMINAL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 20),
        
        // Lane Selector
        Container(
          height: 50,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: ['1', '2', '3'].map((id) {
              final active = _selectedLane == id;
              return Padding(
                padding: const EdgeInsets.only(right: 12),
                child: ChoiceChip(
                  label: Text('LANE $id'),
                  selected: active,
                  onSelected: (s) => setState(() => _selectedLane = id),
                  backgroundColor: Colors.white.withOpacity(0.05),
                  selectedColor: accent.withOpacity(0.2),
                  labelStyle: TextStyle(
                    color: active ? accent : Colors.white38,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                  ),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: active ? accent.withOpacity(0.5) : Colors.transparent)),
                ),
              );
            }).toList(),
          ),
        ),
        
        const SizedBox(height: 20),
        
        // Camera View (Simulated AI Feed like Web)
        Container(
          height: 240,
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.1)),
          ),
          child: Stack(
            children: [
              // Placeholder for the real stream
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.videocam_off_rounded, color: Colors.white10, size: 48),
                    const SizedBox(height: 16),
                    Text('LENS NODE L-$_selectedLane SYNCING...'.toUpperCase(), style: const TextStyle(color: Colors.white10, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 3)),
                  ],
                ),
              ),
              
              // Tactical Overlays
              Positioned(
                top: 16,
                left: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: Colors.black.withOpacity(0.6), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.cyan.withOpacity(0.3))),
                  child: Row(
                    children: [
                      Container(width: 6, height: 6, decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                      const Text('AI LIVE · 12 FPS', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ),
              
              Positioned(
                bottom: 16,
                right: 16,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.black.withOpacity(0.6), borderRadius: BorderRadius.circular(8)),
                  child: Text('PCE SCORE: ${(l['pceScore'] ?? 0).toStringAsFixed(0)}', style: const TextStyle(color: Colors.cyanAccent, fontSize: 9, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 32),
        
        // Detected Objects List
        const Text('DETECTION ANALYTICS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        _detectionRow('Ambulance', '${l['vehicles']?['ambulance'] ?? 0}', Colors.redAccent),
        _detectionRow('Buses', '${l['vehicles']?['bus'] ?? 0}', Colors.purpleAccent),
        _detectionRow('Cars', '${l['vehicles']?['car'] ?? 0}', Colors.greenAccent),
        _detectionRow('Bikes', '${l['vehicles']?['bike'] ?? 0}', Colors.amberAccent),
        
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _detectionRow(String label, String count, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(width: 12, height: 12, decoration: BoxDecoration(color: color.withOpacity(0.2), shape: BoxShape.circle, border: Border.all(color: color.withOpacity(0.5)))),
          const SizedBox(width: 16),
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w500)),
          const Spacer(),
          Text(count, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}
