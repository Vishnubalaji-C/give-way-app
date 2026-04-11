import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/ws_service.dart';

class QrLinkScreen extends StatefulWidget {
  const QrLinkScreen({super.key});

  @override
  State<QrLinkScreen> createState() => _QrLinkScreenState();
}

class _QrLinkScreenState extends State<QrLinkScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _scanning = true;

  void _onDetect(BarcodeCapture capture) async {
    if (!_scanning) return;
    final List<Barcode> barcodes = capture.barcodes;
    
    for (final barcode in barcodes) {
      if (barcode.rawValue != null) {
        setState(() => _scanning = false);
        try {
          final data = jsonDecode(barcode.rawValue!);
          
          if (data['i'] != null && data['p'] != null && data['s'] != null) {
            // Secure Handshake: Verify Signature
            final sig = utf8.decode(base64.decode(data['s']));
            if (sig == 'GIVEWAY_NODE_KEY') {
              // Update WsService with scanned data
              WsService.manualLink(
                ip: data['i'],
                port: data['p'],
                token: data['t'] ?? '',
              );
              
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Uplink Securely Established!'),
                    backgroundColor: Colors.green,
                  ),
                );
                Navigator.pop(context, true);
              }
              return;
            }
          }
          throw Exception('Invalid Sync Signal');
        } catch (e) {
          setState(() => _scanning = true);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Sync Error: $e'), backgroundColor: Colors.red),
            );
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Uplink Mobile', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: ValueListenableBuilder<MobileScannerState>(
              valueListenable: _controller,
              builder: (context, state, child) {
                switch (state.torchState) {
                  case TorchState.off:
                    return const Icon(Icons.flash_off, color: Colors.grey);
                  case TorchState.on:
                    return const Icon(Icons.flash_on, color: Colors.cyan);
                  case TorchState.unavailable:
                    return const Icon(Icons.flash_off, color: Colors.red);
                  default:
                    return const Icon(Icons.flash_off, color: Colors.grey);
                }
              },
            ),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          // Professional Overlay
          CustomPaint(
            painter: ScannerOverlayPainter(),
            child: Container(),
          ),
          Positioned(
            bottom: 80,
            left: 0,
            right: 0,
            child: Column(
              children: [
                const Text(
                  'CENTER CODE IN ALIGNMENT BOX',
                  style: TextStyle(
                    color: Colors.white70,
                    letterSpacing: 2,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: Colors.cyan.withOpacity(0.3)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.shield_outlined, color: Colors.cyan, size: 16),
                      const SizedBox(width: 8),
                      const Text(
                        'ANTIGRAVITY SYNC v4.2',
                        style: TextStyle(color: Colors.cyan, fontSize: 10, fontWeight: FontWeight.black),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ScannerOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black.withOpacity(0.7)
      ..style = PaintingStyle.fill;

    final scanAreaSize = size.width * 0.7;
    final scanAreaRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2),
      width: scanAreaSize,
      height: scanAreaSize,
    );

    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height)),
        Path()..addRRect(RRect.fromRectAndRadius(scanAreaRect, const Radius.circular(30))),
      ),
      paint,
    );

    // Border around scan area
    final borderPaint = Paint()
      ..color = Colors.cyan.withOpacity(0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    
    canvas.drawRRect(RRect.fromRectAndRadius(scanAreaRect, const Radius.circular(30)), borderPaint);

    // Corner guides
    final guidePaint = Paint()
      ..color = Colors.cyan
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round;

    const length = 40.0;
    // Top Left
    canvas.drawPath(Path()..moveTo(scanAreaRect.left, scanAreaRect.top + length)..lineTo(scanAreaRect.left, scanAreaRect.top)..lineTo(scanAreaRect.left + length, scanAreaRect.top), guidePaint);
    // Top Right
    canvas.drawPath(Path()..moveTo(scanAreaRect.right - length, scanAreaRect.top)..lineTo(scanAreaRect.right, scanAreaRect.top)..lineTo(scanAreaRect.right, scanAreaRect.top + length), guidePaint);
    // Bottom Left
    canvas.drawPath(Path()..moveTo(scanAreaRect.left, scanAreaRect.bottom - length)..lineTo(scanAreaRect.left, scanAreaRect.bottom)..lineTo(scanAreaRect.left + length, scanAreaRect.bottom), guidePaint);
    // Bottom Right
    canvas.drawPath(Path()..moveTo(scanAreaRect.right - length, scanAreaRect.bottom)..lineTo(scanAreaRect.right, scanAreaRect.bottom)..lineTo(scanAreaRect.right, scanAreaRect.bottom - length), guidePaint);
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
