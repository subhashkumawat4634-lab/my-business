import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Theme & Common Components
import { Colors } from './src/theme/colors';
import { Header } from './src/components/common/Header';
import { BottomNav, TabItem } from './src/components/common/BottomNav';
import { Button } from './src/components/common/Button';
import { FormModal } from './src/ui';
import { SiteFormModal } from './src/components/sites/SiteFormModal';

// Pages
import { AuthPage } from './src/pages/Auth';
import { DashboardPage } from './src/pages/Dashboard';
import { SitesPage } from './src/pages/Sites';
import { AttendancePage } from './src/pages/Attendance';
import { LabourPage } from './src/pages/Labour';
import { HisabPage } from './src/pages/Hisab';
import { ReportsPage } from './src/pages/Reports';

// API & Helpers
import { getToken, saveToken, request, commandKey } from './src/api';
import { attendanceForm, entryForm, siteForm, workerForm, voidForm } from './src/forms';
import { pdfReport, shareReport } from './src/report';
import { FormSpec, Row, Snapshot } from './src/types';

const NAV_TABS: TabItem[] = [
  { key: 'home', label: 'Overview', icon: 'grid-outline' },
  { key: 'sites', label: 'Sites', icon: 'business-outline' },
  { key: 'attendance', label: 'Haziri', icon: 'calendar-outline' },
  { key: 'team', label: 'Labour', icon: 'people-outline' },
  { key: 'ledger', label: 'Hisab', icon: 'wallet-outline' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-outline' },
];

function MainApp() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);

  const [tab, setTab] = useState('home');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const [form, setForm] = useState<FormSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const pendingRef = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    getToken()
      .then((t) => {
        setToken(t);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  async function refresh(t = token) {
    if (!t) return;
    setRefreshing(true);
    try {
      setData(await request('/snapshot', t));
      setError('');
    } catch (e: any) {
      setError(e.message);
      if (e.status === 401) {
        await saveToken(null);
        setToken(null);
        setData(null);
      }
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (token) refresh(token);
  }, [token]);

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(id);
    }
  }, [toast]);

  async function handleLogin(newToken: string) {
    await saveToken(newToken);
    setToken(newToken);
  }

  async function handleLogout() {
    try {
      await request('/auth/logout', token, {});
    } catch (e) {
      // Session revoked or offline
    } finally {
      await saveToken(null);
      setToken(null);
      setData(null);
      setSelectedSiteId(null);
      setTab('home');
    }
  }

  function openForm(spec: FormSpec) {
    pendingRef.current = null;
    setError('');
    setForm(spec);
  }

  async function handleSaveForm(values: Record<string, string>) {
    if (!form || busy) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        action: form.action,
        entity_id: form.entity_id,
        data: form.transform(values),
      };
      const signature = JSON.stringify(body);
      if (pendingRef.current?.signature !== signature) {
        pendingRef.current = { signature, key: commandKey() };
      }
      await request('/commands', token, {
        ...body,
        key: pendingRef.current.key,
      });
      setForm(null);
      pendingRef.current = null;
      setToast('Successfully saved');
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleNavigate(targetTab: string) {
    setTab(targetTab);
    setSelectedSiteId(null);
    setError('');
  }

  async function handleShareReport(pdf = false, siteId?: string) {
    if (!data) return;
    try {
      if (pdf) {
        await pdfReport(data, siteId);
      } else {
        const msg = await shareReport(data, siteId);
        setToast(msg);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  const openEntryModal = (
    kind: string,
    siteId?: string,
    workerId?: string,
    bill?: Row
  ) => {
    if (!data?.sites.length) {
      setToast('Please add a work site first');
      return;
    }
    if (kind === 'WAGE_PAYMENT' && !data?.workers.length) {
      setToast('Please add a worker first');
      return;
    }
    openForm(entryForm(data, kind, siteId, workerId, bill));
  };

  const openAttendanceModal = (
    siteId?: string,
    workerId?: string,
    existing?: Row
  ) => {
    if (!data?.sites.length || !data?.workers.some((w) => w.active)) {
      setToast('Add an active worker and site first');
      return;
    }
    openForm(attendanceForm(data, siteId, workerId, existing));
  };

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorDesc}>{error}</Text>
            <Button
              title="Retry Connection"
              onPress={() => refresh()}
              style={{ marginTop: 12 }}
            />
            <Button
              title="Sign Out"
              variant="secondary"
              onPress={handleLogout}
              style={{ marginTop: 8 }}
            />
          </View>
        ) : (
          <ActivityIndicator size="large" color={Colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  // Determine current page header details
  const currentSite = selectedSiteId
    ? data.sites.find((s) => s.id === selectedSiteId)
    : null;

  const headerTitle =
    tab === 'sites' && currentSite
      ? currentSite.name
      : tab === 'home'
      ? 'ThekaBook'
      : tab === 'sites'
      ? 'Work Sites'
      : tab === 'attendance'
      ? 'Daily Haziri'
      : tab === 'team'
      ? 'Labour & Team'
      : tab === 'ledger'
      ? 'Hisab & Ledger'
      : 'Reports';

  const headerSubtitle =
    tab === 'sites' && currentSite
      ? currentSite.owner_name
      : data.organization.name;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* BHIM UPI Style Header */}
      <Header
        title={headerTitle}
        subtitle={headerSubtitle}
        onBack={
          tab === 'sites' && selectedSiteId
            ? () => setSelectedSiteId(null)
            : undefined
        }
        onRefresh={() => refresh()}
        onLogout={handleLogout}
        refreshing={refreshing}
        userInitials={data.user.name}
      />

      {/* Toast notification */}
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* Main Screen Content */}
      <View style={styles.content}>
        {tab === 'home' && (
          <DashboardPage
            data={data}
            refreshing={refreshing}
            onRefresh={() => refresh()}
            onOpenSite={(sId) => {
              setSelectedSiteId(sId);
              setTab('sites');
            }}
            onOpenNewSite={() => openForm(siteForm())}
            onOpenAttendance={() => openAttendanceModal()}
            onOpenEntry={(kind) => openEntryModal(kind)}
            onNavigateTab={handleNavigate}
          />
        )}

        {tab === 'sites' && (
          <SitesPage
            data={data}
            selectedSiteId={selectedSiteId}
            onSelectSite={setSelectedSiteId}
            onOpenNewSite={() => openForm(siteForm())}
            onEditSite={(s) => openForm(siteForm(s))}
            onOpenEntry={openEntryModal}
            onOpenAttendance={openAttendanceModal}
            onShareReport={(sId) => handleShareReport(false, sId)}
            refreshing={refreshing}
            onRefresh={() => refresh()}
          />
        )}

        {tab === 'attendance' && (
          <AttendancePage
            data={data}
            onOpenAttendanceModal={openAttendanceModal}
            refreshing={refreshing}
            onRefresh={() => refresh()}
          />
        )}

        {tab === 'team' && (
          <LabourPage
            data={data}
            onOpenWorkerModal={(w) => openForm(workerForm(w))}
            onOpenPaymentModal={(wId) =>
              openEntryModal('WAGE_PAYMENT', undefined, wId)
            }
            refreshing={refreshing}
            onRefresh={() => refresh()}
          />
        )}

        {tab === 'ledger' && (
          <HisabPage
            data={data}
            onOpenEntry={openEntryModal}
            onOpenVoidModal={(entry) => openForm(voidForm(entry))}
            refreshing={refreshing}
            onRefresh={() => refresh()}
          />
        )}

        {tab === 'reports' && (
          <ReportsPage
            data={data}
            onGenerateReport={handleShareReport}
            refreshing={refreshing}
            onRefresh={() => refresh()}
          />
        )}
      </View>

      {/* BHIM UPI Style Footer Bottom Navigation */}
      <BottomNav
        tabs={NAV_TABS}
        activeTab={tab}
        onTabPress={handleNavigate}
      />

      {/* Form Modal */}
      {form && form.action.startsWith('site.') ? (
        <SiteFormModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form ? (
        <FormModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.background,
  },
  errorBox: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.danger,
    marginBottom: 6,
  },
  errorDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  toast: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  toastText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
});
