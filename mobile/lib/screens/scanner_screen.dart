import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/ws_service.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> with SingleTickerProviderStateMixin {
  bool _isScanning = true;
  late AnimationController _animationController;
  late Animation<double> _scanAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    
    _scanAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(
          'LINK DEVICE UPLINK',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 3),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        centerTitle: true,
      ),
      body: Stack(
        children: [
          MobileScanner(
            onDetect: (capture) async {
              if (!_isScanning) return;
              final List<Barcode> barcodes = capture.barcodes;
              for (final barcode in barcodes) {
                if (barcode.rawValue != null) {
                  _isScanning = false;
                  final String url = barcode.rawValue!;
                  
                  await WsService.updateUrl(url);
                  
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Row(
                          children: [
                            const Icon(Icons.check_circle, color: Colors.black),
                            const SizedBox(width: 12),
                            Text('Uplink Secure: $url', style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        backgroundColor: const Color(0xFF00E5FF),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    );
                    Navigator.pop(context, true);
                  }
                  break;
                }
              }
            },
          ),
          
          // ── Digital HUD Overlay ───────────────────────────
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.2), width: 1),
                borderRadius: BorderRadius.circular(32),
              ),
              child: Stack(
                children: [
                  // Corners
                  _buildCorner(top: 0, left: 0, rotation: 0),
                  _buildCorner(top: 0, right: 0, rotation: 1.57),
                  _buildCorner(bottom: 0, left: 0, rotation: 4.71),
                  _buildCorner(bottom: 0, right: 0, rotation: 3.14),

                  // Animated Scan Line
                  AnimatedBuilder(
                    animation: _scanAnimation,
                    builder: (context, child) {
                      return Positioned(
                        top: 20 + (220 * _scanAnimation.value),
                        left: 20,
                        right: 20,
                        child: Container(
                          height: 2,
                          decoration: BoxDecoration(
                            boxShadow: [
                              BoxShadow(color: const Color(0xFF00E5FF).withOpacity(0.8), blurRadius: 10, spreadRadius: 2),
                            ],
                            gradient: LinearGradient(
                              colors: [
                                const Color(0xFF00E5FF).withOpacity(0),
                                const Color(0xFF00E5FF),
                                const Color(0xFF00E5FF).withOpacity(0),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
          
          Positioned(
            bottom: 100,
            left: 40,
            right: 40,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.6),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
              ),
              child: Column(
                children: [
                  Text(
                    'ALIGN QR CODE WITHIN FRAME',
                    style: GoogleFonts.inter(
                      color: Colors.white.withOpacity(0.5),
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Icon(Icons.qr_code_scanner_rounded, color: Color(0xFF00E5FF), size: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCorner({double? top, double? bottom, double? left, double? right, required double rotation}) {
    return Positioned(
      top: top, bottom: bottom, left: left, right: right,
      child: Transform.rotate(
        angle: rotation,
        child: Container(
          width: 30,
          height: 30,
          decoration: const BoxDecoration(
            border: Border(
              top: BorderSide(color: Color(0xFF00E5FF), width: 3),
              left: BorderSide(color: Color(0xFF00E5FF), width: 3),
            ),
          ),
        ),
      ),
    );
  }
}
