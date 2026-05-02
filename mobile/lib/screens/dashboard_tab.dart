import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:animate_do/animate_do.dart';
import 'package:shimmer/shimmer.dart';
import '../services/ws_service.dart';
import '../widgets/junction_sim.dart';
import 'dart:ui';

class DashboardTab extends StatelessWidget {
  final Map<String, dynamic> state;
  final List<Map<String, dynamic>> alerts;
  final WsService ws;
  final String userName;

  const DashboardTab({
    super.key,
    required this.state,
    required this.alerts,
    required this.ws,
    required this.userName,
  });

  @override
  Widget build(BuildContext context) {
    final accent = const Color(0xFF00E5FF);
    final lanes = (state['lanes'] as Map<String, dynamic>?) ?? {};
    
    if (state.isEmpty) {
      return _buildShimmerLoading();
    }

    double avgWait = 0;
    if (lanes.isNotEmpty) {
      int totalWait = 0;
      lanes.forEach((k, v) => totalWait += (v['waitTime'] as int? ?? 0));
      avgWait = totalWait / lanes.length;
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      physics: const BouncingScrollPhysics(),
      children: [
        FadeInDown(duration: const Duration(milliseconds: 600), child: _buildHero(accent)),
        const SizedBox(height: 24),

        FadeIn(delay: const Duration(milliseconds: 300), child: _buildSystemControl(context, accent)),
        const SizedBox(height: 24),

        FadeInUp(delay: const Duration(milliseconds: 350), child: _buildModeSwitcher(context, accent)),
        const SizedBox(height: 24),

        FadeInUp(delay: const Duration(milliseconds: 400), child: _buildTacticalHub(context, accent)),
        const SizedBox(height: 32),

        FadeInUp(delay: const Duration(milliseconds: 500), child: _buildMetricsGrid(avgWait)),
        const SizedBox(height: 32),

        FadeInUp(
          delay: const Duration(milliseconds: 600),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('ADAPTIVE TRAFFIC LOAD', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
              const SizedBox(height: 16),
              ...lanes.entries.map((e) => _buildLaneCard(context, e.key, e.value, accent)),
            ],
          ),
        ),
        const SizedBox(height: 32),

        FadeInUp(
          delay: const Duration(milliseconds: 700),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('AI INTELLIGENCE STREAM', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
              const SizedBox(height: 16),
              Container(
                height: 220,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [Colors.white.withOpacity(0.01), Colors.white.withOpacity(0.03)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(color: Colors.white.withOpacity(0.05)),
                ),
                child: ClipRRect(borderRadius: BorderRadius.circular(32), child: JunctionSim(state: state)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 32),
        FadeInUp(delay: const Duration(milliseconds: 800), child: _buildSystemEvents()),
        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildHero(Color accent) {
    final hour = DateTime.now().hour;
    String greeting = 'Good Morning';
    if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
    else if (hour >= 17 && hour < 21) greeting = 'Good Evening';
    else if (hour >= 21 || hour < 6) greeting = 'Good Night';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.shield_rounded, color: accent, size: 16),
            const SizedBox(width: 8),
            Text('SYSTEM SECURE · V5.0', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: accent, letterSpacing: 2)),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
              child: const Text('ENCRYPTED', style: TextStyle(color: Colors.green, fontSize: 8, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(greeting, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white38)),
        Text(userName.split(' ')[0], style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -1.5, height: 1.1)),
      ],
    );
  }

  Widget _buildSystemControl(BuildContext context, Color accent) {
    final isRunning = state['simulationRunning'] == true;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.02), borderRadius: BorderRadius.circular(32), border: Border.all(color: Colors.white.withOpacity(0.05))),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () {
                HapticFeedback.heavyImpact();
                ws.send(isRunning ? 'STOP_SIM' : 'START_SIM');
              },
              borderRadius: BorderRadius.circular(20),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: BoxDecoration(
                  color: isRunning ? Colors.redAccent.withOpacity(0.15) : accent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(isRunning ? Icons.stop_rounded : Icons.play_arrow_rounded, color: isRunning ? Colors.redAccent : Colors.black, size: 24),
                    const SizedBox(width: 12),
                    Text(isRunning ? 'HALT SYSTEM' : 'BOOT SYSTEM', style: TextStyle(color: isRunning ? Colors.redAccent : Colors.black, fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          InkWell(
            onTap: () { ws.send('RESET_SIM'); _showStatus(context, 'STATE PURGED', Colors.amberAccent); },
            child: Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white.withOpacity(0.1))), child: const Icon(Icons.refresh_rounded, color: Colors.white38)),
          ),
        ],
      ),
    );
  }

  Widget _buildModeSwitcher(BuildContext context, Color accent) {
    final activeMode = state['overrideMode'] ?? 'auto';
    final activeLane = state['activeLane'] ?? '1';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('SYSTEM OPERATIONAL MODE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: Colors.white.withOpacity(0.02), borderRadius: BorderRadius.circular(32), border: Border.all(color: Colors.white.withOpacity(0.05))),
          child: Column(
            children: [
              Row(
                children: [
                  _modeBtn(context, 'auto', '🤖 AI', activeMode == 'auto'),
                  const SizedBox(width: 8),
                  _modeBtn(context, 'vip', '👑 VIP', activeMode == 'vip'),
                  const SizedBox(width: 8),
                  _modeBtn(context, 'festival', '🎉 FEST', activeMode == 'festival'),
                  const SizedBox(width: 8),
                  _modeBtn(context, 'all_stop', '🚨 STOP', activeMode == 'all_stop'),
                ],
              ),
              if (activeMode == 'vip') ...[
                const SizedBox(height: 20),
                const Divider(color: Colors.white10),
                const SizedBox(height: 16),
                const Text('SELECT VIP ESCORT ROUTE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Colors.cyanAccent, letterSpacing: 1)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _vipLaneBtn(context, '1', 'PRIMARY', activeLane == '1'),
                    const SizedBox(width: 8),
                    _vipLaneBtn(context, '2', 'SECOND', activeLane == '2'),
                    const SizedBox(width: 8),
                    _vipLaneBtn(context, '3', 'TRANSV', activeLane == '3'),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _modeBtn(BuildContext context, String mode, String label, bool isActive) {
    return Expanded(
      child: InkWell(
        onTap: () { ws.send('SET_OVERRIDE', {'mode': mode}); _showStatus(context, '${label.toUpperCase()} MODE ACTIVE', Colors.cyanAccent); },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(color: isActive ? Colors.cyanAccent.withOpacity(0.15) : Colors.white.withOpacity(0.03), borderRadius: BorderRadius.circular(12), border: Border.all(color: isActive ? Colors.cyanAccent.withOpacity(0.4) : Colors.white.withOpacity(0.05))),
          child: Center(child: Text(label, style: TextStyle(color: isActive ? Colors.cyanAccent : Colors.white38, fontSize: 10, fontWeight: FontWeight.bold))),
        ),
      ),
    );
  }

  Widget _vipLaneBtn(BuildContext context, String id, String label, bool isActive) {
    return Expanded(
      child: InkWell(
        onTap: () { ws.send('SET_OVERRIDE', {'mode': 'vip', 'targetLane': id}); _showStatus(context, 'LANE $id LOCKED FOR VIP', Colors.cyanAccent); },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(color: isActive ? Colors.cyanAccent : Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(12), border: Border.all(color: isActive ? Colors.cyanAccent : Colors.white.withOpacity(0.1))),
          child: Center(child: Text(label, style: TextStyle(color: isActive ? Colors.black : Colors.white70, fontSize: 9, fontWeight: FontWeight.w900))),
        ),
      ),
    );
  }

  Widget _buildTacticalHub(BuildContext context, Color accent) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.indigo.withOpacity(0.1), Colors.indigo.withOpacity(0.05)], begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(36), border: Border.all(color: Colors.indigo.withOpacity(0.2))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.indigoAccent.withOpacity(0.2), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.security_rounded, color: Colors.indigoAccent, size: 18)),
              const SizedBox(width: 16),
              const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('TACTICAL OVERRIDE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 1)),
                Text('SAFETY_INTERVAL: 2.0s', style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.indigoAccent, letterSpacing: 1)),
              ]),
            ],
          ),
          const SizedBox(height: 24),
          _tacticalBtn(context, 'L1: TRIGGER AMBULANCE', Colors.redAccent, () => ws.send('SIMULATE_RFID', { 'laneId': '1', 'vehicleType': 'ambulance', 'tagId': 'AMB-EMG-101' })),
          const SizedBox(height: 12),
          _tacticalBtn(context, 'L2: TRIGGER BUS PRIORITY', Colors.cyanAccent, () => ws.send('SIMULATE_RFID', { 'laneId': '2', 'vehicleType': 'bus', 'tagId': 'BUS-PT-402' })),
          const SizedBox(height: 12),
          _tacticalBtn(context, 'L3: SIMULATE TRAFFIC BURST', Colors.amberAccent, () => ws.send('SIMULATE_TRAFFIC_BURST', { 'laneId': '3' })),
        ],
      ),
    );
  }

  Widget _tacticalBtn(BuildContext context, String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: () { onTap(); _showStatus(context, 'TRIGGER EXECUTED', color); },
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 20),
        decoration: BoxDecoration(color: color.withOpacity(0.05), borderRadius: BorderRadius.circular(20), border: Border.all(color: color.withOpacity(0.1))),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1)),
          Icon(Icons.chevron_right_rounded, color: color.withOpacity(0.3), size: 18),
        ]),
      ),
    );
  }

  Widget _buildMetricsGrid(double avgWait) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      childAspectRatio: 1.1,
      children: [
        _metricCard('AMBULANCES', '${state['totalAmbulances'] ?? 0}', Colors.redAccent, Icons.flash_on_rounded),
        _metricCard('BUSES', '${state['totalBuses'] ?? 0}', Colors.cyanAccent, Icons.navigation_rounded),
        _metricCard('AVG WAIT', '${avgWait.toStringAsFixed(1)}s', Colors.amberAccent, Icons.timer_rounded),
        _metricCard('ACTIVE NODES', '${(state['lanes'] as Map?)?.length ?? 0}', Colors.white24, Icons.hub_rounded),
      ],
    );
  }

  Widget _metricCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: color.withOpacity(0.04), borderRadius: BorderRadius.circular(32), border: Border.all(color: color.withOpacity(0.1))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: color, size: 18)),
          const Spacer(),
          Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: color, letterSpacing: -1.5)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 1.5)),
        ],
      ),
    );
  }

  Widget _buildLaneCard(BuildContext context, String id, Map<String, dynamic> lane, Color accent) {
    final signal = lane['signal'] ?? 'red';
    final density = lane['density'] ?? 0;
    final width = MediaQuery.of(context).size.width * 0.7;
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: signal == 'green' ? accent.withOpacity(0.08) : Colors.white.withOpacity(0.02), borderRadius: BorderRadius.circular(32), border: Border.all(color: signal == 'green' ? accent.withOpacity(0.3) : Colors.white.withOpacity(0.05))),
      child: Column(
        children: [
          Row(
            children: [
              Container(width: 40, height: 40, decoration: BoxDecoration(color: signal == 'green' ? accent : Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(14)), child: Center(child: Text(id, style: TextStyle(color: signal == 'green' ? Colors.black : Colors.white24, fontSize: 16, fontWeight: FontWeight.w900)))),
              const SizedBox(width: 20),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('LANE $id NODE', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5)),
                Text(id == '3' ? 'AI OPTICAL · PULSED' : 'RFID SECURE · EM-18', style: TextStyle(color: (id == '3' ? Colors.amberAccent : accent).withOpacity(0.6), fontSize: 9, fontWeight: FontWeight.bold)),
              ])),
              Text('$density', style: TextStyle(color: signal == 'green' ? accent : Colors.white24, fontSize: 24, fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 20),
          Stack(children: [
            Container(height: 6, decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(10))),
            AnimatedContainer(duration: const Duration(milliseconds: 1000), curve: Curves.easeOutCubic, height: 6, width: width * (density / 50.0).clamp(0.0, 1.0), decoration: BoxDecoration(gradient: LinearGradient(colors: [signal == 'green' ? accent : Colors.white10, signal == 'green' ? accent.withOpacity(0.5) : Colors.white10]), borderRadius: BorderRadius.circular(10))),
          ]),
        ],
      ),
    );
  }

  Widget _buildSystemEvents() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Row(children: [Icon(Icons.history_toggle_off_rounded, color: Colors.white38, size: 18), SizedBox(width: 12), Text('SYSTEM AUDIT LOG', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white24, letterSpacing: 2))]),
      const SizedBox(height: 20),
      if (alerts.isEmpty) const Center(child: Padding(padding: EdgeInsets.all(40.0), child: Text('BUFFERING DATA...', style: TextStyle(color: Colors.white10, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 3))))
      else ...alerts.take(5).map((a) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: a['type'] == 'emergency' ? Colors.redAccent.withOpacity(0.08) : Colors.white.withOpacity(0.02), borderRadius: BorderRadius.circular(20), border: Border.all(color: a['type'] == 'emergency' ? Colors.redAccent.withOpacity(0.2) : Colors.white.withOpacity(0.05))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(_formatTime(a['timestamp']), style: const TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.bold)),
            if (a['type'] == 'emergency') Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.redAccent, borderRadius: BorderRadius.circular(4)), child: const Text('CRITICAL', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w900))),
          ]),
          const SizedBox(height: 8),
          Text(a['message'] ?? '', style: TextStyle(color: a['type'] == 'emergency' ? Colors.white : Colors.white60, fontSize: 12, height: 1.4)),
        ]),
      )),
    ]);
  }

  void _showStatus(BuildContext context, String message, Color color) {
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Row(children: [Icon(Icons.check_circle_rounded, color: color, size: 16), const SizedBox(width: 12), Text(message, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 10))]), backgroundColor: const Color(0xFF030712).withOpacity(0.9), behavior: SnackBarBehavior.floating, margin: const EdgeInsets.all(20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), duration: const Duration(seconds: 1)));
  }

  Widget _buildShimmerLoading() {
    return ListView(padding: const EdgeInsets.all(20), children: List.generate(5, (index) => Shimmer.fromColors(baseColor: Colors.white.withOpacity(0.05), highlightColor: Colors.white.withOpacity(0.1), child: Container(margin: const EdgeInsets.only(bottom: 20), height: index == 0 ? 120 : (index == 1 ? 80 : 150), decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(24))))));
  }

  String _formatTime(dynamic ts) {
    if (ts == null) return '--:--';
    final dt = DateTime.fromMillisecondsSinceEpoch(ts is int ? ts : int.parse(ts.toString()));
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
