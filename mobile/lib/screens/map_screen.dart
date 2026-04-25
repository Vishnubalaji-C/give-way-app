import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class MapScreen extends StatelessWidget {
  final Map<String, dynamic> state;

  const MapScreen({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    final junction = state['junction'] ?? {};
    final lat = (junction['lat'] ?? 10.3673).toDouble();
    final lng = (junction['lng'] ?? 77.9803).toDouble();
    final name = junction['name'] ?? 'Active Junction';

    return Stack(
      children: [
        FlutterMap(
          options: MapOptions(
            initialCenter: LatLng(lat, lng),
            initialZoom: 15.0,
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              subdomains: const ['a', 'b', 'c'],
              tileBuilder: (context, tileWidget, tile) {
                return ColorFiltered(
                  colorFilter: const ColorFilter.matrix([
                    -0.2126, -0.7152, -0.0722, 0, 255,
                    -0.2126, -0.7152, -0.0722, 0, 255,
                    -0.2126, -0.7152, -0.0722, 0, 255,
                    0, 0, 0, 1, 0,
                  ]),
                  child: tileWidget,
                );
              },
            ),
            MarkerLayer(
              markers: [
                Marker(
                  point: LatLng(lat, lng),
                  width: 80,
                  height: 80,
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.8),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.cyan.withOpacity(0.5)),
                        ),
                        child: Text(
                          name,
                          style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const Icon(Icons.location_on_rounded, color: Colors.cyanAccent, size: 40),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
        // Overlay info
        Positioned(
          bottom: 100,
          left: 20,
          right: 20,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF030712).withOpacity(0.9),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withOpacity(0.1)),
              boxShadow: [BoxShadow(color: Colors.cyan.withOpacity(0.1), blurRadius: 20)],
            ),
            child: Row(
              children: [
                const Icon(Icons.gps_fixed_rounded, color: Colors.cyanAccent, size: 20),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('TACTICAL GRID ACTIVE', style: TextStyle(color: Colors.white24, fontSize: 8, fontWeight: FontWeight.w900, letterSpacing: 1)),
                      Text('$lat°N, $lng°E', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold, fontFeatures: [FontFeature.tabularFigures()])),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                  child: const Text('SYNCED', style: TextStyle(color: Colors.green, fontSize: 8, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
