import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';

const SITE_URL = 'https://polypharm-ade.vercel.app';
const SAFETY_API = `${SITE_URL}/api/safety/live`;
const PPB_SOURCE_URL = 'https://pv.pharmacyboardkenya.org/reports/medications_summary';
const MEDICINES_KEY = 'polypharm.saved-medicines.v1';

type Screen = 'home' | 'guide' | 'medicines';
type LiveReport = {
  totalReportedErrors: number;
  currentYearReportedErrors: number;
  priorYearReportedErrors: number;
  currentYear: number;
  fetchedAt: string;
  source?: string;
};

const formatNumber = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-KE').format(value)
    : '—';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [report, setReport] = useState<LiveReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState('');
  const [medicines, setMedicines] = useState<string[] | null>(null);
  const [medicineInput, setMedicineInput] = useState('');

  const refreshReport = useCallback(async () => {
    setLoadingReport(true);
    setReportError('');
    try {
      const response = await fetch(SAFETY_API, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('The public report is temporarily unavailable.');
      const data = (await response.json()) as LiveReport;
      setReport(data);
    } catch {
      setReportError('Live report unavailable. Try again later or open the PPB source.');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    void refreshReport();
    void SecureStore.getItemAsync(MEDICINES_KEY)
      .then(value => setMedicines(value ? (JSON.parse(value) as string[]) : []))
      .catch(() => setMedicines([]));
  }, [refreshReport]);

  const saveMedicines = async (next: string[]) => {
    setMedicines(next);
    try {
      await SecureStore.setItemAsync(MEDICINES_KEY, JSON.stringify(next));
    } catch {
      Alert.alert('Could not save list', 'Your medicines could not be saved securely on this device.');
    }
  };

  const addMedicine = () => {
    const value = medicineInput.trim().replace(/\s+/g, ' ');
    if (!value) return;
    if (value.length > 80) {
      Alert.alert('Name too long', 'Keep each medicine name under 80 characters.');
      return;
    }
    const current = medicines ?? [];
    if (current.some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      Alert.alert('Already on your list', `${value} is already saved on this device.`);
      return;
    }
    if (current.length >= 20) {
      Alert.alert('List is full', 'You can save up to 20 medicine names.');
      return;
    }
    setMedicineInput('');
    void saveMedicines([...current, value]);
  };

  const shareMedicineList = async () => {
    const items = medicines ?? [];
    if (!items.length) {
      Alert.alert('Your list is empty', 'Add a medicine before sharing the list.');
      return;
    }
    await Share.share({
      title: 'My medicine list',
      message: `My medicine list\n\n${items.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n\nCheck these entries with a pharmacist or clinician.`,
    });
  };

  const openLink = (path = '') => Linking.openURL(`${SITE_URL}${path}`);
  const updatedTime = report?.fetchedAt
    ? new Date(report.fetchedAt).toLocaleTimeString('en-KE', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('./assets/icon.png')} style={styles.logo} />
            <View>
              <Text style={styles.brandTitle}>Polypharm ADE</Text>
              <Text style={styles.brandSubtitle}>MEDICINE SAFETY</Text>
            </View>
          </View>
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
        </View>

        {screen === 'home' && (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>MEDICATION SAFETY IN KENYA</Text>
              <Text style={styles.heroTitle}>Safer medicine conversations start here.</Text>
              <Text style={styles.heroCopy}>Keep a private medicine list, explore practical safety guidance, and follow public reporting updates.</Text>
              <Pressable style={styles.primaryButton} onPress={() => setScreen('medicines')}>
                <Text style={styles.primaryButtonText}>Open my medicine list</Text>
                <Text style={styles.primaryArrow}>→</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeading}>
              <View><Text style={styles.eyebrow}>PUBLIC REPORTS</Text><Text style={styles.sectionTitle}>Medication reports</Text></View>
              <Pressable onPress={() => void refreshReport()} accessibilityRole="button" accessibilityLabel="Refresh public report data">
                {loadingReport ? <ActivityIndicator color={colors.teal} /> : <Text style={styles.refresh}>Refresh</Text>}
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Reports listed" value={formatNumber(report?.totalReportedErrors)} tone="violet" />
              <StatCard label={report?.currentYear ? `${report.currentYear} reports` : 'This year'} value={formatNumber(report?.currentYearReportedErrors)} tone="teal" />
            </View>
            <Text style={styles.meta}>{reportError || (updatedTime ? `Retrieved ${updatedTime} EAT · Pharmacy and Poisons Board` : 'Loading the latest public report…')}</Text>
            <Pressable onPress={() => void Linking.openURL(PPB_SOURCE_URL)} accessibilityRole="link"><Text style={styles.sourceLink}>View the official PPB report →</Text></Pressable>
            <Text style={styles.caveat}>These are submitted reports, not a count of every medicine error or a population risk rate.</Text>

            <View style={styles.actionCard}>
              <View style={styles.actionIcon}><Text style={styles.actionIconText}>✚</Text></View>
              <View style={styles.actionCopy}><Text style={styles.cardTitle}>FDA drug-label lookup</Text><Text style={styles.cardCopy}>Open the Clinical App website to sign in and review available FDA label information.</Text></View>
              <Pressable onPress={() => void openLink('/clinical-app')} accessibilityRole="button" accessibilityLabel="Open the Clinical App website"><Text style={styles.actionArrow}>→</Text></Pressable>
            </View>
            <View style={styles.actionCard}>
              <View style={[styles.actionIcon, styles.actionIconTeal]}><Text style={styles.actionIconText}>i</Text></View>
              <View style={styles.actionCopy}><Text style={styles.cardTitle}>Practical safety guide</Text><Text style={styles.cardCopy}>Read simple steps for checking medicine directions and preparing questions.</Text></View>
              <Pressable onPress={() => setScreen('guide')} accessibilityRole="button" accessibilityLabel="Open practical safety guide"><Text style={styles.actionArrow}>→</Text></Pressable>
            </View>
          </>
        )}

        {screen === 'guide' && <SafetyGuide onOpenWebsite={() => void openLink('/evidence')} />}

        {screen === 'medicines' && (
          <View style={styles.contentScreen}>
            <Text style={styles.eyebrow}>PRIVATE TO THIS DEVICE</Text>
            <Text style={styles.pageTitle}>My medicine list</Text>
            <Text style={styles.pageIntro}>Save medicine names to review with a pharmacist or clinician. Your list stays on this device unless you choose to share it.</Text>
            <View style={styles.inputRow}>
              <TextInput value={medicineInput} onChangeText={setMedicineInput} onSubmitEditing={addMedicine} placeholder="Type a medicine name" placeholderTextColor="#8390ad" returnKeyType="done" maxLength={80} style={styles.input} accessibilityLabel="Medicine name" />
              <Pressable style={styles.addButton} onPress={addMedicine} accessibilityRole="button"><Text style={styles.addButtonText}>Add</Text></Pressable>
            </View>
            {medicines === null ? <ActivityIndicator color={colors.teal} /> : medicines.length === 0 ? (
              <View style={styles.emptyState}><Text style={styles.emptyTitle}>Your list is empty</Text><Text style={styles.cardCopy}>Add the medicine names you want to discuss at your next review.</Text></View>
            ) : medicines.map((item, index) => (
              <View key={`${item}-${index}`} style={styles.medicineRow}>
                <View style={styles.medicineBullet}><Text style={styles.medicineBulletText}>{index + 1}</Text></View>
                <Text style={styles.medicineName}>{item}</Text>
                <Pressable onPress={() => void saveMedicines(medicines.filter((_, itemIndex) => itemIndex !== index))} accessibilityRole="button" accessibilityLabel={`Remove ${item}`}><Text style={styles.remove}>Remove</Text></Pressable>
              </View>
            ))}
            <View style={styles.buttonRow}>
              <Pressable style={styles.secondaryButton} onPress={() => void shareMedicineList()}><Text style={styles.secondaryButtonText}>Share list</Text></Pressable>
              {!!medicines?.length && <Pressable style={styles.secondaryButton} onPress={() => Alert.alert('Clear medicine list?', 'This removes the saved names from this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => void saveMedicines([]) }])}><Text style={styles.secondaryButtonText}>Clear list</Text></Pressable>}
            </View>
            <View style={styles.notice}><Text style={styles.noticeText}>This is a personal reminder, not a verified prescription or interaction check. Confirm every entry and care decision with a qualified health professional.</Text></View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerCopy}>Polypharm ADE · Medication information support</Text>
          <Pressable onPress={() => void openLink('/privacy-policy')}><Text style={styles.footerLink}>Privacy policy</Text></Pressable>
          <Pressable onPress={() => void openLink()}><Text style={styles.footerLink}>Open website</Text></Pressable>
        </View>
      </ScrollView>

      <View style={styles.tabBar}>
        <TabButton label="Home" active={screen === 'home'} onPress={() => setScreen('home')} icon="⌂" />
        <TabButton label="Safety guide" active={screen === 'guide'} onPress={() => setScreen('guide')} icon="✓" />
        <TabButton label="My list" active={screen === 'medicines'} onPress={() => setScreen('medicines')} icon="☷" />
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'violet' | 'teal' }) {
  return (
    <View style={[styles.statCard, tone === 'teal' && styles.statCardTeal]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === 'teal' && styles.statValueTeal]}>{value}</Text>
      <Text style={styles.statUnit}>PPB public dashboard</Text>
    </View>
  );
}

function SafetyGuide({ onOpenWebsite }: { onOpenWebsite: () => void }) {
  return (
    <View style={styles.contentScreen}>
      <Text style={styles.eyebrow}>PRACTICAL MEDICINE SUPPORT</Text>
      <Text style={styles.pageTitle}>Small steps can support safer medicine use.</Text>
      <Text style={styles.pageIntro}>Use these steps to prepare for a useful conversation about medicines.</Text>
      <GuideStep number="01" title="Check" text="Read the medicine label and follow the written directions. Note anything that is unclear." />
      <GuideStep number="02" title="Ask" text="Talk with a pharmacist or clinician about questions, side effects, or how medicines fit together." />
      <GuideStep number="03" title="Act" text="Follow the guidance you receive, and contact a health professional if a concern remains." />
      <View style={styles.notice}><Text style={styles.noticeText}>This app provides general education and public report summaries. It does not diagnose, prescribe, or replace a pharmacist or clinician.</Text></View>
      <Pressable style={styles.secondaryButton} onPress={onOpenWebsite}><Text style={styles.secondaryButtonText}>Evidence, privacy & limits</Text></Pressable>
    </View>
  );
}

function GuideStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <View style={styles.guideStep}>
      <View style={styles.guideNumber}><Text style={styles.guideNumberText}>{number}</Text></View>
      <View style={styles.guideCopy}><Text style={styles.guideTitle}>{title}</Text><Text style={styles.cardCopy}>{text}</Text></View>
    </View>
  );
}

function TabButton({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon: string }) {
  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}>
      <Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </Pressable>
  );
}

const colors = { background: '#0d1228', panel: '#171f3b', line: '#2d3856', text: '#f3f5ff', muted: '#a7b4d2', teal: '#65dfd3', blue: '#8ac8f5', violet: '#c8b8ff' };

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  page: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff' },
  brandTitle: { color: colors.teal, fontSize: 16, fontWeight: '800' },
  brandSubtitle: { color: colors.muted, fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#1d765d', backgroundColor: '#123e3a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5ee7a5' },
  liveText: { color: '#a9f4cb', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  hero: { borderRadius: 24, padding: 22, marginBottom: 26, backgroundColor: '#192447', borderWidth: 1, borderColor: '#344467' },
  eyebrow: { color: colors.teal, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 9 },
  heroTitle: { color: colors.text, fontSize: 31, lineHeight: 37, fontWeight: '800', letterSpacing: -0.5 },
  heroCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 20 },
  primaryButton: { minHeight: 48, borderRadius: 13, backgroundColor: colors.teal, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15 },
  primaryButtonText: { color: '#0d2530', fontSize: 14, fontWeight: '800' },
  primaryArrow: { color: '#0d2530', fontSize: 21, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  refresh: { color: colors.teal, fontSize: 13, fontWeight: '700', padding: 8 },
  statsRow: { flexDirection: 'row', gap: 11 },
  statCard: { flex: 1, minHeight: 128, borderRadius: 17, borderWidth: 1, borderColor: '#514784', backgroundColor: '#201b43', padding: 14 },
  statCardTeal: { borderColor: '#276b77', backgroundColor: '#142e3b' },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  statValue: { color: colors.violet, fontSize: 27, fontWeight: '900', marginTop: 14 },
  statValueTeal: { color: colors.teal },
  statUnit: { color: '#7f8ca9', fontSize: 9, marginTop: 4 },
  meta: { color: '#94a3c1', fontSize: 11, marginTop: 11 },
  sourceLink: { color: colors.teal, fontSize: 11, fontWeight: '700', paddingVertical: 8 },
  caveat: { color: '#7684a2', fontSize: 11, lineHeight: 16, marginTop: 5, marginBottom: 18 },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 10 },
  actionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#2d2555', justifyContent: 'center', alignItems: 'center' },
  actionIconTeal: { backgroundColor: '#143d48' },
  actionIconText: { color: colors.teal, fontSize: 20, fontWeight: '800' },
  actionCopy: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  cardCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  actionArrow: { color: colors.teal, fontSize: 23, paddingHorizontal: 3 },
  contentScreen: { paddingTop: 6, minHeight: 460 },
  pageTitle: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', marginBottom: 8 },
  pageIntro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 22 },
  guideStep: { flexDirection: 'row', gap: 14, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.line },
  guideNumber: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: '#6652bb', backgroundColor: '#211b45', alignItems: 'center', justifyContent: 'center' },
  guideNumberText: { color: colors.violet, fontWeight: '900', fontSize: 13 },
  guideCopy: { flex: 1 },
  guideTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 3 },
  notice: { borderLeftWidth: 3, borderLeftColor: '#e8bd62', backgroundColor: '#28283b', padding: 13, borderRadius: 9, marginTop: 20, marginBottom: 14 },
  noticeText: { color: '#d7d6e2', fontSize: 11, lineHeight: 17 },
  inputRow: { flexDirection: 'row', gap: 9, marginBottom: 15 },
  input: { flex: 1, minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 13, color: colors.text, backgroundColor: '#111a33', fontSize: 14 },
  addButton: { minWidth: 68, borderRadius: 12, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  addButtonText: { color: '#0d2530', fontWeight: '800' },
  emptyState: { borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 18, backgroundColor: colors.panel },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  medicineRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.line },
  medicineBullet: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#242147', alignItems: 'center', justifyContent: 'center' },
  medicineBulletText: { color: colors.violet, fontSize: 10, fontWeight: '800' },
  medicineName: { flex: 1, color: colors.text, fontSize: 14 },
  remove: { color: '#ff9aa8', fontSize: 11, padding: 8 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#4b5a7a', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, marginTop: 8 },
  secondaryButtonText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 18, marginTop: 32, alignItems: 'center', gap: 11 },
  footerCopy: { color: '#7885a4', fontSize: 10 },
  footerLink: { color: colors.teal, fontSize: 11, fontWeight: '700', padding: 4 },
  tabBar: { minHeight: 66, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: '#111831', paddingBottom: 5 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 7 },
  tabIcon: { color: '#73809c', fontSize: 19, height: 23 },
  tabLabel: { color: '#8793ad', fontSize: 10, fontWeight: '600' },
  tabActive: { color: colors.teal },
});
