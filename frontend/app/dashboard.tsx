import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api, Employee, SalaryCluster } from '../src/api';
import { useAuth } from '../src/auth';

const money = (amount: number | null) => amount === null ? '—' : `฿${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

function confirmDelete(action: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm('Are you sure?')) action();
    return;
  }
  Alert.alert('Delete employee', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: action },
  ]);
}

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') globalThis.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function DashboardScreen() {
  const { token, ready, logout } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clusters, setClusters] = useState<SalaryCluster[] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState('');
  const [employeesError, setEmployeesError] = useState('');
  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [status, setStatus] = useState<Employee['status']>('Active');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editStatus, setEditStatus] = useState<Employee['status']>('Active');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadEmployees = async (showSpinner = false) => {
    if (!token) return;
    if (showSpinner) setRefreshing(true);
    setError('');
    setEmployeesError('');
    try {
      const result = await api.employees(token, search);
      setEmployees(result.employees);
      setEmployeesError('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load employees.';
      setEmployees([]);
      setEmployeesError(message);
      setError(message);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => void loadEmployees(), 250);
    return () => clearTimeout(timer);
  }, [token, search]);
  if (!ready) return <View style={styles.center}><ActivityIndicator color="#1769AA" /></View>;
  if (!token) return <Redirect href="/login" />;

  const addEmployee = async () => {
    if (!name.trim() || !position.trim() || !salary.trim()) {
      showMessage('Missing information', 'Complete all employee fields before adding.');
      return;
    }
    const numericSalary = Number(salary);
    if (!Number.isFinite(numericSalary) || numericSalary <= 0) {
      showMessage('Invalid salary', 'Enter a salary greater than zero.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await api.addEmployee(token, { name: name.trim(), position: position.trim(), status, salary: numericSalary });
      setName(''); setPosition(''); setSalary(''); setStatus('Active'); setClusters(null);
      await loadEmployees();
      showMessage('Employee added', 'The employee record was saved.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not add employee.';
      setError(message);
      showMessage('Could not add employee', message);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setEditName(employee.name);
    setEditPosition(employee.position);
    setEditSalary(String(employee.salary));
    setEditStatus(employee.status);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const numericSalary = Number(editSalary);
    if (!editName.trim() || !editPosition.trim() || !editSalary.trim() || !Number.isFinite(numericSalary) || numericSalary <= 0) {
      showMessage('Invalid employee details', 'Enter a name, position, and salary greater than zero.');
      return;
    }
    setSavingEdit(true);
    setError('');
    try {
      await api.updateEmployee(token, editing.id, { name: editName.trim(), position: editPosition.trim(), status: editStatus, salary: numericSalary });
      setEditing(null);
      setClusters(null);
      await loadEmployees();
      showMessage('Employee updated', 'The employee record was saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update employee.');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleStatus = async (employee: Employee) => {
    setWorkingId(employee.id); setError('');
    try {
      await api.toggleStatus(token, employee.id);
      setClusters(null);
      await loadEmployees();
      showMessage('Status updated', `${employee.name}'s status was changed.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not update status.';
      setError(message);
      showMessage('Could not update status', message);
    } finally { setWorkingId(null); }
  };

  const deleteEmployee = async (id: string) => {
    setWorkingId(id); setError('');
    try {
      await api.deleteEmployee(token, id);
      setClusters(null);
      await loadEmployees();
      showMessage('Employee deleted', 'The employee record was removed.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not delete employee.';
      setError(message);
      showMessage('Could not delete employee', message);
    } finally { setWorkingId(null); }
  };

  const analyze = async () => {
    setAnalyticsLoading(true); setError(''); setClusters(null);
    try {
      const result = await api.salaryClusters(token);
      setClusters(result.clusters);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Salary analysis failed.';
      setError(message);
      showMessage('Salary analysis failed', message);
    } finally { setAnalyticsLoading(false); }
  };

  const employeeCard = ({ item }: { item: Employee }) => (
    <View style={styles.employeeRow}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Text></View>
      <View style={styles.employeeInfo}>
        <Text style={styles.employeeId}>ID {item.id}</Text>
        <Text style={styles.employeeName}>{item.name}</Text>
        <Text style={styles.employeePosition}>{item.position}</Text>
        <View style={styles.employeeMeta}>
          <View style={[styles.statusDot, item.status === 'Active' ? styles.activeDot : styles.leaveDot]} />
          <Text style={[styles.statusText, item.status === 'Active' ? styles.activeText : styles.leaveText]}>{item.status}</Text>
          <Text style={styles.metaDivider}>·</Text>
          <Text style={styles.salaryText}>{money(item.salary)}</Text>
        </View>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity accessibilityLabel={`Edit ${item.name}`} style={styles.iconButton} onPress={() => openEdit(item)}>
          <Ionicons name="create-outline" size={19} color="#52647A" />
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel={`Toggle status for ${item.name}`} style={styles.iconButton} onPress={() => void toggleStatus(item)} disabled={workingId === item.id}>
          {workingId === item.id ? <ActivityIndicator size="small" color="#1769AA" /> : <Ionicons name="swap-horizontal-outline" size={19} color="#52647A" />}
        </TouchableOpacity>
        <TouchableOpacity accessibilityLabel={`Delete ${item.name}`} style={styles.iconButton} onPress={() => confirmDelete(() => void deleteEmployee(item.id))} disabled={workingId === item.id}>
          <Ionicons name="trash-outline" size={18} color="#AF5147" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={initialLoading ? [] : employees}
        renderItem={employeeCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadEmployees(true)} tintColor="#1769AA" />}
        ListHeaderComponent={(
          <>
            <View style={styles.topbar}>
              <View style={styles.brandLine}><View style={styles.brandMark}><Ionicons name="people" size={18} color="#FFFFFF" /></View><Text style={styles.brandText}>TAPANAPONG <Text style={styles.brandMuted}>/ HR</Text></Text></View>
              <TouchableOpacity onPress={() => void logout()} style={styles.logout}><Text style={styles.logoutText}>Sign out</Text><Ionicons name="log-out-outline" size={17} color="#51615A" /></TouchableOpacity>
            </View>
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>PEOPLE OPERATIONS · 2026</Text>
              <Text style={styles.title}>Team overview</Text>
              <Text style={styles.subtitle}>A practical snapshot of your people and compensation.</Text>
            </View>
            {error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={19} color="#A23D35" /><Text style={styles.errorText}>{error}</Text>{employeesError ? <TouchableOpacity accessibilityLabel="Retry loading employees" onPress={() => void loadEmployees(true)}><Ionicons name="refresh-outline" size={20} color="#8D3932" /></TouchableOpacity> : null}</View> : null}
            <View style={styles.statsRow}>
              <View style={styles.stat}><Text style={styles.statLabel}>TEAM MEMBERS</Text><Text style={styles.statValue}>{initialLoading || employeesError ? '—' : employees.length}</Text></View>
              <View style={styles.stat}><Text style={styles.statLabel}>ACTIVE</Text><Text style={styles.statValue}>{initialLoading || employeesError ? '—' : employees.filter((person) => person.status === 'Active').length}</Text></View>
              <View style={styles.stat}><Text style={styles.statLabel}>MONTHLY PAYROLL</Text><Text style={[styles.statValue, styles.payroll]}>{initialLoading || employeesError ? '—' : money(employees.reduce((total, person) => total + person.salary, 0))}</Text></View>
            </View>
            <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Salary structure</Text><Text style={styles.sectionCaption}>Three compensation tiers, calculated from current salaries</Text></View>
              <TouchableOpacity style={[styles.analyzeButton, analyticsLoading && styles.dimmed]} onPress={() => void analyze()} disabled={analyticsLoading}>
                {analyticsLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="analytics-outline" size={17} color="#FFFFFF" />}
                <Text style={styles.analyzeText}>Analyze Salary Structure</Text>
              </TouchableOpacity>
            </View>
            {clusters ? (clusters.length === 0 || clusters.every((cluster) => cluster.count === 0) ? <Text style={styles.inlineEmpty}>No salary data available.</Text> : (
              <><View style={styles.clusterRow}>{clusters.map((cluster, index) => <View key={cluster.group} style={[styles.clusterCard, index === 1 && styles.clusterMid, index === 2 && styles.clusterHigh]}>
                <Text style={styles.clusterTier}>{cluster.group.toUpperCase()}</Text><Text style={styles.clusterAmount}>{money(cluster.centroid)}</Text><Text style={styles.clusterCount}>{cluster.count} {cluster.count === 1 ? 'employee' : 'employees'}</Text>
              </View>)}</View><Text style={styles.analyticsNote}>K-Means is unsupervised machine learning, not Generative AI.</Text></>
            )) : null}
            <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Employees</Text><Text style={styles.sectionCaption}>{initialLoading ? 'Loading team...' : employeesError ? 'List unavailable' : `${employees.length} people in your workspace`}</Text></View></View>
            <View style={styles.searchBox}><Ionicons name="search-outline" size={18} color="#718096" /><TextInput style={styles.searchInput} value={search} onChangeText={(value) => { setSearch(value); setSearchLoading(true); }} placeholder="Search ID, name, position, or status" placeholderTextColor="#8792A3" returnKeyType="search" />{searchLoading ? <ActivityIndicator size="small" color="#1769AA" /> : null}</View>
            <View style={styles.addForm}>
              <View style={styles.formHead}><Ionicons name="person-add-outline" size={18} color="#1769AA" /><Text style={styles.formTitle}>Add an employee</Text></View>
              <View style={styles.formGrid}>
                <TextInput style={[styles.field, styles.fieldWide]} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#87918B" />
                <TextInput style={[styles.field, styles.fieldWide]} value={position} onChangeText={setPosition} placeholder="Position" placeholderTextColor="#87918B" />
                <TextInput style={styles.field} value={salary} onChangeText={setSalary} placeholder="Monthly salary" placeholderTextColor="#87918B" keyboardType="decimal-pad" />
                <TouchableOpacity style={styles.statusPicker} onPress={() => setStatus((current) => current === 'Active' ? 'On Leave' : 'Active')}><Text style={styles.statusPickerText}>{status}</Text><Ionicons name="chevron-down" size={15} color="#52645B" /></TouchableOpacity>
                <TouchableOpacity style={[styles.addButton, adding && styles.dimmed]} onPress={() => void addEmployee()} disabled={adding}>
                  {adding ? <ActivityIndicator color="#FFFFFF" size="small" /> : <><Ionicons name="add" size={19} color="#FFFFFF" /><Text style={styles.addButtonText}>Add employee</Text></>}
                </TouchableOpacity>
              </View>
            </View>
            {initialLoading ? <View style={styles.loading}><ActivityIndicator color="#1769AA" /><Text style={styles.loadingText}>Loading your team...</Text></View> : null}
          </>
        )}
        ListEmptyComponent={!initialLoading && !employeesError ? <View style={styles.empty}><Ionicons name="people-outline" size={25} color="#77837C" /><Text style={styles.emptyTitle}>{search ? 'No matching employees' : 'No employees yet'}</Text><Text style={styles.emptyCopy}>{search ? 'Try another ID, name, position, or status.' : 'Add a team member to get started.'}</Text></View> : null}
        ListFooterComponent={<Text style={styles.footer}>EMPLOYEE RECORDS FROM YOUR CONFIGURED MYSQL DATABASE</Text>}
      />
      <Modal visible={Boolean(editing)} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}><View style={styles.modalPanel}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Edit employee</Text><TouchableOpacity accessibilityLabel="Close edit form" onPress={() => setEditing(null)}><Ionicons name="close" size={22} color="#52645B" /></TouchableOpacity></View>
          <TextInput style={styles.modalField} value={editName} onChangeText={setEditName} placeholder="Full name" placeholderTextColor="#87918B" />
          <TextInput style={styles.modalField} value={editPosition} onChangeText={setEditPosition} placeholder="Position" placeholderTextColor="#87918B" />
          <TextInput style={styles.modalField} value={editSalary} onChangeText={setEditSalary} placeholder="Monthly salary" placeholderTextColor="#87918B" keyboardType="decimal-pad" />
          <TouchableOpacity style={styles.statusPicker} onPress={() => setEditStatus((current) => current === 'Active' ? 'On Leave' : 'Active')}><Text style={styles.statusPickerText}>{editStatus}</Text><Ionicons name="chevron-down" size={15} color="#52645B" /></TouchableOpacity>
          <TouchableOpacity style={[styles.addButton, styles.saveButton]} onPress={() => void saveEdit()} disabled={savingEdit}>{savingEdit ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.addButtonText}>Save changes</Text>}</TouchableOpacity>
        </View></View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F7FC' },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topbar: { height: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#DCE5F0' },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 31, height: 31, borderRadius: 9, backgroundColor: '#1769AA', alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 12, fontWeight: '900', color: '#21334D', letterSpacing: 0.8 },
  brandMuted: { color: '#718096', fontWeight: '600' },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingLeft: 9 },
  logoutText: { fontSize: 12, color: '#52647A', fontWeight: '700' },
  heading: { paddingTop: 30, paddingBottom: 21 },
  eyebrow: { color: '#1769AA', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#172B45', fontSize: 31, fontWeight: '800', marginTop: 7 },
  subtitle: { color: '#718096', fontSize: 13, marginTop: 5 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 5, borderColor: '#E7C5C0', borderWidth: 1, backgroundColor: '#FFF5F3', marginBottom: 15 },
  errorText: { flex: 1, color: '#8D3932', fontSize: 12, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 29 },
  stat: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5F0', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 14 },
  statLabel: { color: '#718096', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { color: '#21334D', fontSize: 22, fontWeight: '800', marginTop: 9 },
  payroll: { fontSize: 18, color: '#1769AA' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  sectionTitle: { color: '#21334D', fontSize: 17, fontWeight: '800' },
  sectionCaption: { color: '#718096', fontSize: 11, marginTop: 4 },
  searchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 5, marginBottom: 12 },
  searchInput: { flex: 1, height: 42, color: '#21334D', fontSize: 12 },
  analyzeButton: { minHeight: 39, paddingHorizontal: 12, borderRadius: 5, backgroundColor: '#1769AA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  analyzeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  dimmed: { opacity: 0.65 },
  clusterRow: { flexDirection: 'row', gap: 10, marginBottom: 27 },
  clusterCard: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5E5F5', borderTopWidth: 3, borderTopColor: '#1769AA', borderRadius: 5, padding: 13 },
  clusterMid: { borderColor: '#C7DDF1', borderTopColor: '#4F8CC9' },
  clusterHigh: { borderColor: '#AFC9E4', borderTopColor: '#163E70' },
  clusterTier: { color: '#52647A', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  clusterAmount: { color: '#21334D', fontSize: 18, fontWeight: '800', marginTop: 10 },
  clusterCount: { color: '#718096', fontSize: 10, marginTop: 5 },
  inlineEmpty: { color: '#78837C', fontSize: 12, marginVertical: 14 },
  analyticsNote: { color: '#79847D', fontSize: 10, marginTop: -19, marginBottom: 24 },
  addForm: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5F0', borderRadius: 6, padding: 15, marginBottom: 14 },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  formTitle: { color: '#21334D', fontSize: 12, fontWeight: '800' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { flexGrow: 1, flexBasis: 130, height: 42, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 4, paddingHorizontal: 10, color: '#21334D', fontSize: 12, backgroundColor: '#F8FBFF' },
  fieldWide: { flexBasis: 180 },
  statusPicker: { minHeight: 42, flexGrow: 1, flexBasis: 130, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 4, paddingHorizontal: 10, backgroundColor: '#F8FBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPickerText: { color: '#21334D', fontSize: 12, fontWeight: '700' },
  addButton: { height: 42, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#163E70', paddingHorizontal: 13, borderRadius: 4 },
  addButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  employeeRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E4EBF4', paddingHorizontal: 12, paddingVertical: 10 },
  avatar: { height: 38, width: 38, borderRadius: 19, backgroundColor: '#E7F1FB', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  avatarText: { color: '#1769AA', fontSize: 11, fontWeight: '900' },
  employeeInfo: { flex: 1, minWidth: 0 },
  employeeName: { color: '#21334D', fontSize: 13, fontWeight: '800' },
  employeeId: { color: '#8492A6', fontSize: 9, fontWeight: '700', marginBottom: 2 },
  employeePosition: { color: '#718096', fontSize: 11, marginTop: 3 },
  employeeMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  statusDot: { height: 6, width: 6, borderRadius: 3 },
  activeDot: { backgroundColor: '#278365' },
  leaveDot: { backgroundColor: '#B48B3B' },
  statusText: { fontSize: 10, fontWeight: '700' },
  activeText: { color: '#278365' },
  leaveText: { color: '#A27B32' },
  metaDivider: { color: '#A6AEA8', marginHorizontal: 1, fontSize: 10 },
  salaryText: { color: '#52647A', fontSize: 10, fontWeight: '700' },
  rowActions: { flexDirection: 'row', gap: 2, marginLeft: 4 },
  iconButton: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  loading: { flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#748078', fontSize: 12 },
  empty: { alignItems: 'center', padding: 30, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5F0', borderRadius: 5 },
  emptyTitle: { color: '#21334D', fontSize: 13, fontWeight: '800', marginTop: 9 },
  emptyCopy: { color: '#718096', fontSize: 11, marginTop: 4 },
  footer: { color: '#8492A6', fontSize: 9, fontWeight: '700', letterSpacing: 0.7, textAlign: 'center', marginTop: 26 },
  modalBackdrop: { flex: 1, padding: 20, backgroundColor: 'rgba(23, 43, 69, 0.42)', justifyContent: 'center', alignItems: 'center' },
  modalPanel: { width: '100%', maxWidth: 460, gap: 10, padding: 20, backgroundColor: '#FFFFFF', borderRadius: 7 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { color: '#21334D', fontSize: 18, fontWeight: '800' },
  modalField: { height: 44, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 4, paddingHorizontal: 11, color: '#21334D', fontSize: 13, backgroundColor: '#F8FBFF' },
  saveButton: { marginTop: 5 },
});