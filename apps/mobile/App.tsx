import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Theme & Common Components
import { Colors } from './src/theme/colors';
import { BottomNav, TabItem } from './src/components/common/BottomNav';
import { Button } from './src/components/common/Button';
import { FormModal } from './src/ui';
import { SiteFormModal } from './src/components/sites/SiteFormModal';
import { AttendanceModal } from './src/components/attendance/AttendanceModal';
import { MaterialBillModal } from './src/components/bills/MaterialBillModal';
import { ExtraWorkModal } from './src/components/bills/ExtraWorkModal';
import { ReceivePaymentModal } from './src/components/bills/ReceivePaymentModal';
import { ExpenseBillModal } from './src/components/bills/ExpenseBillModal';
import { WorkerFormModal } from './src/components/workers/WorkerFormModal';
import { LabourPaymentModal } from './src/components/workers/LabourPaymentModal';
import { VoidEntryModal } from './src/components/common/VoidEntryModal';

// Pages
import { AuthPage } from './src/pages/Auth';
import { DashboardPage } from './src/pages/Dashboard';
import { SitesPage, NewSitePage } from './src/pages/Sites';
import { AttendancePage } from './src/pages/Attendance';
import { LabourPage } from './src/pages/Labour';
import { HisabPage } from './src/pages/Hisab';
import { ReportsPage } from './src/pages/Reports';
import { ProfilePage } from './src/pages/Profile';

// API & Helpers
import { getToken, saveToken, request, commandKey } from './src/api';
import { attendanceForm, entryForm, siteForm, workerForm, voidForm } from './src/forms';
import { pdfReport, shareReport } from './src/report';
import { FormSpec, Row, Snapshot } from './src/types';
import { LanguageProvider, useLanguage } from './src/i18n';
import { RedirectingScreen } from './src/components/common/RedirectingScreen';

function MainApp() {
  const { t, lang } = useLanguage();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);

  const navTabs: TabItem[] = [
    { key: 'home', label: t('navOverview', 'Overview'), icon: 'grid-outline' },
    { key: 'sites', label: t('navSites', 'Sites'), icon: 'business-outline' },
    { key: 'attendance', label: t('navAttendance', 'Haziri'), icon: 'calendar-outline' },
    { key: 'team', label: t('navLabour', 'Labour'), icon: 'people-outline' },
    { key: 'ledger', label: t('navHisab', 'Hisab'), icon: 'wallet-outline' },
    { key: 'reports', label: t('navReports', 'Reports'), icon: 'bar-chart-outline' },
  ];

  // Check initial browser path on Web
  const getInitialRouteState = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/sites/new') {
        return { tab: 'sites', selectedSiteId: null, isNewSite: true };
      }
      if (path.startsWith('/sites/') && path.length > 7) {
        return { tab: 'sites', selectedSiteId: path.replace('/sites/', ''), isNewSite: false };
      }
      if (path === '/sites') {
        return { tab: 'sites', selectedSiteId: null, isNewSite: false };
      }
      if (path === '/attendance') {
        return { tab: 'attendance', selectedSiteId: null, isNewSite: false };
      }
      if (path === '/team' || path === '/labour') {
        return { tab: 'team', selectedSiteId: null, isNewSite: false };
      }
      if (path === '/ledger' || path === '/hisab') {
        return { tab: 'ledger', selectedSiteId: null, isNewSite: false };
      }
      if (path === '/reports') {
        return { tab: 'reports', selectedSiteId: null, isNewSite: false };
      }
      if (path === '/profile') {
        return { tab: 'profile', selectedSiteId: null, isNewSite: false };
      }
    }
    return { tab: 'home', selectedSiteId: null, isNewSite: false };
  };

  const initialRoute = useRef(getInitialRouteState()).current;
  const [tab, setTab] = useState(initialRoute.tab);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(initialRoute.selectedSiteId);
  const [isNewSite, setIsNewSite] = useState<boolean>(initialRoute.isNewSite);

  const [form, setForm] = useState<FormSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const pendingRef = useRef<{ signature: string; key: string } | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = 'light';
      document.documentElement.style.backgroundColor = '#F4F6F9';
      if (document.body) {
        document.body.style.backgroundColor = '#F4F6F9';
        document.body.style.color = '#0F172A';
      }
      let styleEl = document.getElementById('thekabook-web-light-styles');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'thekabook-web-light-styles';
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = `
        html, body, #root {
          background-color: #F4F6F9 !important;
          color: #0F172A !important;
          color-scheme: light !important;
        }
        input, textarea, select {
          background-color: transparent !important;
          color: #0F172A !important;
          color-scheme: light !important;
        }
        input::placeholder, textarea::placeholder {
          color: #94A3B8 !important;
        }
      `;
    }

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
      setIsNewSite(false);
      setTab('home');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.pushState(null, '', '/');
      }
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

  async function handleUpdateProfile(values: { name?: string; organization_name?: string }) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        action: 'profile.update',
        data: values,
      };
      await request('/commands', token, {
        ...body,
        key: commandKey(),
      });
      await refresh();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  const tabHistoryRef = useRef<string[]>(['home']);
  const lastBackPressRef = useRef<number>(0);

  function navigate(
    newTab: string,
    urlPath?: string,
    siteId: string | null = null,
    newSite = false
  ) {
    if (newTab !== tab) {
      tabHistoryRef.current = [...tabHistoryRef.current.filter((t) => t !== newTab), newTab];
    }
    setTab(newTab);
    setSelectedSiteId(siteId);
    setIsNewSite(newSite);
    setError('');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const targetUrl =
        urlPath ||
        (newSite
          ? '/sites/new'
          : siteId
          ? `/sites/${siteId}`
          : newTab === 'home'
          ? '/'
          : `/${newTab}`);
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
  }

  // Handle hardware / Android system back button gracefully
  useEffect(() => {
    const onHardwareBackPress = () => {
      // 1. If any modal form is open, close the modal
      if (form) {
        setForm(null);
        setError('');
        return true;
      }

      // 2. If creating new site, go back to sites list
      if (isNewSite) {
        setIsNewSite(false);
        setSelectedSiteId(null);
        setTab('sites');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.pushState(null, '', '/sites');
        }
        return true;
      }

      // 3. If viewing a specific site detail, go back to sites list
      if (selectedSiteId) {
        setSelectedSiteId(null);
        setTab('sites');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.pushState(null, '', '/sites');
        }
        return true;
      }

      // 4. If in profile screen, go back to home tab
      if (tab === 'profile') {
        navigate('home', '/', null, false);
        return true;
      }

      // 5. If on another tab, go back to previous tab or home
      if (tab !== 'home') {
        const prevStack = tabHistoryRef.current.filter((t) => t !== tab);
        const prevTab = prevStack.length > 0 ? prevStack[prevStack.length - 1] : 'home';
        tabHistoryRef.current = prevStack.length > 0 ? prevStack : ['home'];
        navigate(prevTab, prevTab === 'home' ? '/' : `/${prevTab}`, null, false);
        return true;
      }

      // 6. If already on Home (Overview) with nothing open -> Double back to exit
      const now = Date.now();
      if (lastBackPressRef.current && now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      const exitMsg =
        lang === 'hi'
          ? 'ऐप बंद करने के लिए दोबारा बैक दबाएं'
          : 'Press back again to exit app';

      if (Platform.OS === 'android') {
        ToastAndroid.show(exitMsg, ToastAndroid.SHORT);
      } else {
        setToast(exitMsg);
      }
      return true;
    };

    const backSub = BackHandler.addEventListener(
      'hardwareBackPress',
      onHardwareBackPress
    );
    return () => backSub.remove();
  }, [form, isNewSite, selectedSiteId, tab, lang]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onPopState = () => {
        const path = window.location.pathname;
        if (path === '/sites/new') {
          setTab('sites');
          setIsNewSite(true);
          setSelectedSiteId(null);
        } else if (path.startsWith('/sites/') && path.length > 7) {
          setTab('sites');
          setIsNewSite(false);
          setSelectedSiteId(path.replace('/sites/', ''));
        } else if (path === '/sites') {
          setTab('sites');
          setIsNewSite(false);
          setSelectedSiteId(null);
        } else if (path === '/attendance') {
          setTab('attendance');
          setIsNewSite(false);
          setSelectedSiteId(null);
        } else if (path === '/team' || path === '/labour') {
          setTab('team');
          setIsNewSite(false);
          setSelectedSiteId(null);
        } else if (path === '/ledger' || path === '/hisab') {
          setTab('ledger');
          setIsNewSite(false);
          setSelectedSiteId(null);
        } else if (path === '/reports') {
          setTab('reports');
          setIsNewSite(false);
          setSelectedSiteId(null);
        } else if (path === '/profile') {
          setTab('profile');
          setIsNewSite(false);
          setSelectedSiteId(null);
        } else {
          setTab('home');
          setIsNewSite(false);
          setSelectedSiteId(null);
        }
      };
      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    }
  }, []);

  function handleNavigate(targetTab: string) {
    navigate(targetTab, targetTab === 'home' ? '/' : `/${targetTab}`, null, false);
  }

  async function handleCreateNewSite(values: Record<string, string>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const spec = siteForm();
      const body = {
        action: spec.action,
        entity_id: commandKey(),
        data: spec.transform(values),
      };
      const signature = JSON.stringify(body);
      if (pendingRef.current?.signature !== signature) {
        pendingRef.current = { signature, key: commandKey() };
      }
      await request('/commands', token, {
        ...body,
        key: pendingRef.current.key,
      });
      pendingRef.current = null;
      setToast('Site successfully created');
      await refresh();
      navigate('sites', '/sites', null, false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
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
    if (error) {
      return (
        <SafeAreaView style={styles.errorContainer}>
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
        </SafeAreaView>
      );
    }
    return (
      <RedirectingScreen
        title="Loading Workspace..."
        subtitle="Synchronizing project ledger, sites & attendance records"
      />
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Toast notification */}
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      {/* Main Screen Content */}
      <View style={styles.content}>
        {isNewSite ? (
          <NewSitePage
            data={data}
            busy={busy}
            error={error}
            onBack={() => navigate('sites', '/sites', null, false)}
            onSave={handleCreateNewSite}
          />
        ) : (
          <>
            {tab === 'home' && (
              <DashboardPage
                data={data}
                refreshing={refreshing}
                onRefresh={() => refresh()}
                onOpenSite={(sId) => navigate('sites', `/sites/${sId}`, sId, false)}
                onOpenNewSite={() => navigate('sites', '/sites/new', null, true)}
                onOpenAttendance={() => openAttendanceModal()}
                onOpenEntry={(kind) => openEntryModal(kind)}
                onNavigateTab={handleNavigate}
                onUpdateProfile={handleUpdateProfile}
                onLogout={handleLogout}
              />
            )}

            {tab === 'sites' && (
              <SitesPage
                data={data}
                selectedSiteId={selectedSiteId}
                onSelectSite={(sId) => navigate('sites', sId ? `/sites/${sId}` : '/sites', sId, false)}
                onOpenNewSite={() => navigate('sites', '/sites/new', null, true)}
                onEditSite={(s) => openForm(siteForm(s))}
                onOpenEntry={openEntryModal}
                onOpenAttendance={openAttendanceModal}
                onShareReport={(sId) => handleShareReport(false, sId)}
                onOpenProfile={() => handleNavigate('profile')}
                refreshing={refreshing}
                onRefresh={() => refresh()}
              />
            )}

        {tab === 'attendance' && (
          <AttendancePage
            data={data}
            onOpenAttendanceModal={openAttendanceModal}
            onOpenProfile={() => handleNavigate('profile')}
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
            onOpenProfile={() => handleNavigate('profile')}
            refreshing={refreshing}
            onRefresh={() => refresh()}
          />
        )}

        {tab === 'ledger' && (
          <HisabPage
            data={data}
            onOpenEntry={openEntryModal}
            onOpenVoidModal={(entry) => openForm(voidForm(entry))}
            onOpenProfile={() => handleNavigate('profile')}
            refreshing={refreshing}
            onRefresh={() => refresh()}
          />
        )}

        {tab === 'reports' && (
          <ReportsPage
            data={data}
            onGenerateReport={handleShareReport}
            onOpenProfile={() => handleNavigate('profile')}
            refreshing={refreshing}
            onRefresh={() => refresh()}
          />
        )}

        {tab === 'profile' && (
          <ProfilePage
            data={data}
            onBack={() => navigate('home', '/', null, false)}
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
            onRefresh={() => refresh()}
            refreshing={refreshing}
          />
        )}
          </>
        )}
      </View>

      {/* BHIM UPI Style Footer Bottom Navigation */}
      <BottomNav
        tabs={navTabs}
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
      ) : form && form.action === 'attendance.save' && data ? (
        <AttendanceModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form && form.action === 'entry.create' && form.title.toLowerCase().includes('material') && data ? (
        <MaterialBillModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form && form.action === 'entry.create' && (form.title.toLowerCase().includes('expense') || form.title.toLowerCase().includes('kharcha')) && data ? (
        <ExpenseBillModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form && form.action === 'entry.create' && form.title.toLowerCase().includes('extra') && data ? (
        <ExtraWorkModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form && form.action === 'entry.create' && (form.title.toLowerCase().includes('client payment') || form.title.toLowerCase().includes('receipt')) && data ? (
        <ReceivePaymentModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form && form.action === 'entry.create' && (form.title.toLowerCase().includes('labour payment') || form.title.toLowerCase().includes('advance') || form.title.toLowerCase().includes('wage')) && data ? (
        <LabourPaymentModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
        />
      ) : form && form.action.startsWith('worker.') && data ? (
        <WorkerFormModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          data={data}
          worker={form.entity_id ? data.workers.find((w) => w.id === form.entity_id) : undefined}
          busy={busy}
          error={error}
          onClose={() => {
            setForm(null);
            setError('');
          }}
          onSave={handleSaveForm}
          onOpenPaymentModal={(wId) => {
            setForm(null);
            openEntryModal('WAGE_PAYMENT', undefined, wId);
          }}
          onOpenAttendanceModal={(wId) => {
            setForm(null);
            openAttendanceModal(undefined, wId);
          }}
        />
      ) : form && form.action === 'entry.void' && data ? (
        <VoidEntryModal
          key={form.action + (form.entity_id || '')}
          spec={form}
          entry={data.entries.find((e) => e.id === form.entity_id)}
          site={data.sites.find((s) => s.id === data.entries.find((e) => e.id === form.entity_id)?.site_id)}
          worker={data.workers.find((w) => w.id === data.entries.find((e) => e.id === form.entity_id)?.worker_id)}
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
      <LanguageProvider>
        <MainApp />
      </LanguageProvider>
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
