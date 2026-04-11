import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:web_socket_channel/web_socket_channel.dart';

class WsService {
  static String _serverIp = 'makeway-backend.onrender.com';
  static int _serverPort = 443;
  
  static String get baseUrl {
    if (_serverIp == 'makeway-backend.onrender.com') return 'https://$_serverIp';
    return 'http://$_serverIp:$_serverPort';
  }
  
  static String get wsUrl {
    if (_serverIp == 'makeway-backend.onrender.com') return 'wss://$_serverIp';
    return 'ws://$_serverIp:$_serverPort';
  }

  WebSocketChannel? _channel;
  final _stateController = StreamController<Map<String, dynamic>>.broadcast();
  final _alertController = StreamController<Map<String, dynamic>>.broadcast();
  bool _connected = false;
  bool _isDiscovering = false;

  Stream<Map<String, dynamic>> get stateStream => _stateController.stream;
  Stream<Map<String, dynamic>> get alertStream => _alertController.stream;
  bool get connected => _connected;

  static void manualLink({required String ip, required int port, String? token}) {
    print('[UPLINK] Manually Linking to Secure Master at $ip:$port');
    _serverIp = ip;
    _serverPort = port;
    // We could store the token in SharedPreferences here if needed
  }

  void startDiscovery() async {
    if (_isDiscovering) return;
    _isDiscovering = true;
    
    print('[DISCOVERY] Starting Secure Software Hunt...');
    try {
      RawDatagramSocket.bind(InternetAddress.anyIPv4, 5000).then((socket) {
        socket.broadcastEnabled = true;
        socket.listen((RawSocketEvent event) {
          if (event == RawSocketEvent.read) {
            Datagram? dg = socket.receive();
            if (dg != null) {
              try {
                final message = utf8.decode(dg.data);
                final payload = jsonDecode(message);
                
                if (payload['service'] == 'MAKEWAY_MASTER') {
                  // SECURE HANDSHAKE: Verify Signature
                  final sig = utf8.decode(base64.decode(payload['sig']));
                  if (sig == 'GIVEWAY_NODE_KEY') {
                    _serverIp = dg.address.address;
                    _serverPort = payload['port'] ?? 4000;
                    
                    if (!_connected) {
                      print('[DISCOVERY] Found MakeWay Master at $_serverIp. Uplinking...');
                      connect();
                    }
                  }
                }
              } catch (e) { /* Invalid packet */ }
            }
          }
        });
      });
    } catch (e) {
      _isDiscovering = false;
      print('[DISCOVERY] Socket Error: $e');
    }
  }

  void connect() {
    if (_connected) return;
    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _connected = true;

      _channel!.stream.listen(
        (data) {
          final msg = jsonDecode(data);
          switch (msg['type']) {
            case 'INIT':
            case 'STATE_UPDATE':
              _stateController.add(msg['payload']);
              break;
            case 'JUNCTION_SWITCH':
              _stateController.add(msg['payload']['state']);
              break;
            case 'ALERT':
              _alertController.add(msg['payload']);
              break;
            case 'RESET':
              _stateController.add(msg['payload']);
              break;
          }
        },
        onError: (e) {
          _connected = false;
          Future.delayed(const Duration(seconds: 3), connect);
        },
        onDone: () {
          _connected = false;
          Future.delayed(const Duration(seconds: 3), connect);
        },
      );
    } catch (e) {
      _connected = false;
      Future.delayed(const Duration(seconds: 3), connect);
    }
  }

  void send(String type, [Map<String, dynamic>? payload]) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode({
        'type': type,
        if (payload != null) 'payload': payload,
      }));
    }
  }

  void dispose() {
    _channel?.sink.close();
    _stateController.close();
    _alertController.close();
  }
}
