import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:shared_preferences/shared_preferences.dart';

class WsService {
  static String _serverUrl = 'give-way-app.onrender.com';

  static String get baseUrl => _serverUrl.startsWith('http') ? _serverUrl : 'https://$_serverUrl';
  static String get wsUrl   => baseUrl.replaceFirst('http', 'ws');

  static Future<void> updateUrl(String newUrl) async {
    _serverUrl = newUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_url', newUrl);
  }

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _serverUrl = prefs.getString('server_url') ?? 'give-way-app.onrender.com';
  }

  WebSocketChannel? _channel;
  final _stateController = StreamController<Map<String, dynamic>>.broadcast();
  final _alertController = StreamController<Map<String, dynamic>>.broadcast();
  bool _connected = false;

  Stream<Map<String, dynamic>> get stateStream => _stateController.stream;
  Stream<Map<String, dynamic>> get alertStream  => _alertController.stream;
  bool get connected => _connected;

  // Called from main.dart on startup — just connects directly
  void startDiscovery() => connect();

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
        onError: (_) {
          _connected = false;
          Future.delayed(const Duration(seconds: 3), connect);
        },
        onDone: () {
          _connected = false;
          Future.delayed(const Duration(seconds: 3), connect);
        },
      );
    } catch (_) {
      _connected = false;
      Future.delayed(const Duration(seconds: 3), connect);
    }
  }

  void send(String type, [Map<String, dynamic>? payload]) {
    _channel?.sink.add(jsonEncode({
      'type': type,
      if (payload != null) 'payload': payload,
    }));
  }

  void dispose() {
    _channel?.sink.close();
    _stateController.close();
    _alertController.close();
  }
}
