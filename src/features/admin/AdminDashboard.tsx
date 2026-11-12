import { useEffect, useState } from 'react';
import { Link as RouterLink, NavLink, Outlet, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Container, Link, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { apiRequest } from '../../lib/apiClient';

type AdminUser = { id: string; username: string; email: string; role: 'USER' | 'ADMIN'; createdAt: string };
type Person = { id: string; username: string; email: string };
type UserDetail = AdminUser & {
    messages: number; chats: number; lastMessageAt: string | null;
    friends: (Person & { friendsSince: string })[];
    chatMemberships: { joinedAt: string; chat: {
        id: string; name: string | null; chatType: 'DIRECT' | 'GROUP';
        createdAt: string;
        messageStats?: { total: number; sent: number; lastMessageAt: string | null };
        participants: { isAdmin: boolean; user: Person }[];
    } }[];
};
type Point = { date: string; count: number };

function useAdminData<T>(path: string) {
    const [result, setResult] = useState<{ path: string; data?: T; error?: string }>({ path: '' });
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let current = true;
        apiRequest<{ data: T }>(`api/admin/${path}`).then(response => {
            if (current) setResult({ path, data: response.data });
        }).catch((error: unknown) => {
            if (current) setResult({ path, error: error instanceof Error ? error.message : 'Unable to load data.' });
        });
        return () => { current = false; };
    }, [path, attempt]);
    return {
        data: result.path === path ? result.data : undefined,
        error: result.path === path ? result.error : undefined,
        retry: () => { setResult({ path: '' }); setAttempt(value => value + 1); },
    };
}

function LoadState({ error, retry }: { error?: string | undefined; retry: () => void }) {
    return error ? <Alert severity="error" action={<Button color="inherit" onClick={retry}>Retry</Button>}>{error}</Alert>
        : <Box sx={{ py: 5, textAlign: 'center' }} role="status" aria-label="Loading"><CircularProgress /></Box>;
}

function Stats({ items }: { items: [string, number][] }) {
    return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${items.length}, 1fr)` }, gap: 2, my: 3 }}>
        {items.map(([label, value]) => <Paper key={label} elevation={0} sx={{ p: 3 }}>
            <Typography color="text.secondary">{label}</Typography>
            <Typography variant="h4" sx={{ mt: 1, fontWeight: 700 }}>{value.toLocaleString()}</Typography>
        </Paper>)}
    </Box>;
}

export function AdminLayout() {
    return <Box sx={{ height: '100dvh', overflowY: 'auto', backgroundColor: 'background.default' }}>
        <Paper component="header" square elevation={0} sx={{ px: { xs: 2, md: 4 }, py: 2 }}>
            <Stack direction="row" alignItems="center" useFlexGap flexWrap="wrap" gap={2}>
                <Typography variant="h6" sx={{ mr: 2 }}>ChatApp <Box component="span" sx={{ color: 'text.secondary' }}>Admin</Box></Typography>
                <Box component="nav" sx={{ display: 'flex', gap: 1, '& .active': { backgroundColor: 'action.selected', color: 'primary.light' } }}>
                    <Button component={NavLink} to="/admin" end>Overview</Button>
                    <Button component={NavLink} to="/admin/users">Users</Button>
                </Box>
                <Button component={RouterLink} to="/home" sx={{ ml: 'auto' }}>Back to chat</Button>
            </Stack>
        </Paper>
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}><Outlet /></Container>
    </Box>;
}

export function AdminOverview() {
    const { data, error, retry } = useAdminData<{ users: number; chats: number; messages: number }>('overview');
    return <>
        <Typography variant="h4" component="h1">Overview</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>All-time totals across the app.</Typography>
        {data ? <Stats items={[[ 'Users', data.users ], [ 'Chats', data.chats ], [ 'Messages', data.messages ]]} /> : <LoadState error={error} retry={retry} />}
        <ActivityPanel />
    </>;
}

export function AdminUsers() {
    const [params, setParams] = useSearchParams();
    const search = params.get('search') ?? '';
    const rawPage = Number(params.get('page') ?? 1);
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 1000000 ? rawPage : 1;
    const [draft, setDraft] = useState(search);
    const { data, error, retry } = useAdminData<{ users: AdminUser[]; total: number; pageSize: number }>(`users?${new URLSearchParams({ page: String(page), search })}`);
    return <>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>Users</Typography>
        <Stack component="form" direction="row" gap={1} sx={{ mb: 3 }} onSubmit={event => { event.preventDefault(); setParams({ search: draft.trim(), page: '1' }); }}>
            <TextField label="Search name or email" value={draft} onChange={event => setDraft(event.target.value)} size="small" fullWidth inputProps={{ maxLength: 200 }} />
            <Button type="submit" variant="contained">Search</Button>
        </Stack>
        {!data ? <LoadState error={error} retry={retry} /> : <Paper elevation={0}>
            <TableContainer><Table aria-label="Users">
                <TableHead><TableRow>{['Name', 'Email', 'Role', 'Joined (UTC)'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
                <TableBody>{data.users.map(user => <TableRow key={user.id} hover>
                    <TableCell><Link component={RouterLink} to={`/admin/users/${user.id}`}>{user.username}</Link></TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell><Chip size="small" label={user.role} color={user.role === 'ADMIN' ? 'primary' : 'default'} variant="outlined" /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{user.createdAt.slice(0, 10)}</TableCell>
                </TableRow>)}
                    {!data.users.length && <TableRow><TableCell colSpan={4}>No users found.</TableCell></TableRow>}
                </TableBody>
            </Table></TableContainer>
            <TablePagination component="div" count={data.total} page={page - 1} rowsPerPage={25} rowsPerPageOptions={[25]} onPageChange={(_event, next) => setParams({ search, page: String(next + 1) })} />
        </Paper>}
    </>;
}

export function AdminUserDetail() {
    const { userId = '' } = useParams();
    const { data, error, retry } = useAdminData<UserDetail>(`users/${encodeURIComponent(userId)}`);
    return <>
        <Button component={RouterLink} to="/admin/users" sx={{ mb: 2 }}>← Users</Button>
        {!data ? <LoadState error={error} retry={retry} /> : <>
            <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap"><Typography variant="h4" component="h1">{data.username}</Typography><Chip label={data.role} variant="outlined" size="small" /></Stack>
            <Typography color="text.secondary" sx={{ mt: 1, overflowWrap: 'anywhere' }}>{data.email}</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>Joined {data.createdAt.slice(0, 10)} · Last message: {data.lastMessageAt ? `${data.lastMessageAt.slice(0, 19).replace('T', ' ')} UTC` : 'Never'}</Typography>
            <Stats items={[[ 'Messages sent', data.messages ], [ 'Current chats', data.chats ]]} />
            <ActivityPanel key={userId} userId={userId} />
            <UserConnections user={data} />
        </>}
    </>;
}

function UserConnections({ user }: { user: UserDetail }) {
    return <Stack spacing={3} sx={{ mt: 3 }}>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Friends ({user.friends.length})</Typography>
            {!user.friends.length ? <Typography color="text.secondary">No friends yet.</Typography> :
                <TableContainer sx={{ maxHeight: 360 }}><Table stickyHeader size="small" aria-label="User's friends">
                    <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Friends since (UTC)</TableCell></TableRow></TableHead>
                    <TableBody>{user.friends.map(friend => <TableRow key={friend.id} hover>
                        <TableCell><Link component={RouterLink} to={`/admin/users/${friend.id}`}>{friend.username}</Link></TableCell>
                        <TableCell>{friend.email}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{friend.friendsSince.slice(0, 10)}</TableCell>
                    </TableRow>)}</TableBody>
                </Table></TableContainer>}
        </Paper>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Current chats ({user.chatMemberships.length})</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Current participants are shown for each chat.</Typography>
            {!user.chatMemberships.length ? <Typography color="text.secondary">No current chats.</Typography> :
                <Stack spacing={2} sx={{ maxHeight: 560, overflowY: 'auto' }}>{user.chatMemberships.map(({ chat, joinedAt }) => <Box key={chat.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} alignItems="center">
                        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{chat.chatType === 'DIRECT' ? 'Direct chat' : chat.name || 'Unnamed group'}</Typography>
                        <Chip size="small" variant="outlined" label={chat.chatType === 'DIRECT' ? 'Direct' : 'Group'} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>Joined {joinedAt.slice(0, 10)} (UTC) · {chat.id}</Typography>
                    {chat.chatType === 'DIRECT' && chat.messageStats && <Box sx={{ mt: 1 }}>
                        <Typography variant="body2">{chat.messageStats.total.toLocaleString()} messages · {chat.messageStats.sent.toLocaleString()} sent by this user (all time)</Typography>
                        <Typography variant="body2" color="text.secondary">Last message: {chat.messageStats.lastMessageAt ? `${chat.messageStats.lastMessageAt.slice(0, 19).replace('T', ' ')} UTC` : 'No messages yet'}</Typography>
                        <Typography variant="body2" color="text.secondary">Created: {chat.createdAt.slice(0, 19).replace('T', ' ')} UTC</Typography>
                    </Box>}
                    <Stack component="ul" spacing={1} sx={{ pl: 2, mb: 0 }}>
                        {chat.participants.map(({ user: participant, isAdmin }) => <Box component="li" key={participant.id} sx={{ overflowWrap: 'anywhere' }}>
                            <Link component={RouterLink} to={`/admin/users/${participant.id}`}>{participant.username}</Link>
                            {participant.id === user.id && <Typography component="span" variant="body2" color="text.secondary"> (this user)</Typography>}
                            {chat.chatType === 'GROUP' && isAdmin && <Chip size="small" variant="outlined" label="Group admin" sx={{ ml: 1 }} />}
                            <Typography variant="body2" color="text.secondary">{participant.email}</Typography>
                        </Box>)}
                    </Stack>
                </Box>)}</Stack>}
        </Paper>
    </Stack>;
}

function presetRange(days: number) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - days + 1);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function ActivityPanel({ userId }: { userId?: string }) {
    const [preset, setPreset] = useState('30');
    const [range, setRange] = useState(() => presetRange(30));
    const [draft, setDraft] = useState(range);
    const [group, setGroup] = useState('day');
    const [validation, setValidation] = useState('');
    const query = new URLSearchParams({ ...range, group });
    const path = userId ? `users/${encodeURIComponent(userId)}/messages` : 'messages';
    const applyRange = () => {
        const days = (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000 + 1;
        if (!Number.isFinite(days) || days < 1 || days > 366) { setValidation('Choose a range of 1–366 days.'); return; }
        setValidation(''); setRange(draft);
    };
    return <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, mt: 3 }}>
        <Typography variant="h6">{userId ? 'Messages sent' : 'Growth and messages'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>UTC · Weeks start Monday. Boundary buckets include only selected dates.</Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
            <TextField select size="small" label="Date range" value={preset} sx={{ minWidth: 155 }} onChange={event => {
                const value = event.target.value; setPreset(value); setValidation('');
                if (value !== 'custom') { const next = presetRange(Number(value)); setRange(next); setDraft(next); }
            }}>
                {[7, 30, 90].map(days => <MenuItem key={days} value={String(days)}>Last {days} days</MenuItem>)}
                <MenuItem value="custom">Custom</MenuItem>
            </TextField>
            <TextField select size="small" label="Group by" value={group} onChange={event => setGroup(event.target.value)} sx={{ minWidth: 120 }}>
                {['day', 'week', 'month'].map(value => <MenuItem key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</MenuItem>)}
            </TextField>
            {preset === 'custom' && <>
                <TextField type="date" size="small" label="From" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField type="date" size="small" label="To" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                <Button onClick={applyRange} variant="outlined">Apply</Button>
            </>}
        </Stack>
        {validation && <Alert severity="warning" sx={{ mb: 2 }}>{validation}</Alert>}
        <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>{range.from} – {range.to}</Typography>
        {!userId && <ActivitySeries path={`signups?${query}`} title="New users" unit="new users" />}
        <ActivitySeries path={`${path}?${query}`} title={userId ? 'Messages sent' : 'Message volume'} unit="messages" />
    </Paper>;
}

function ActivitySeries({ path, title, unit }: { path: string; title: string; unit: string }) {
    const { data, error, retry } = useAdminData<{ points: Point[] }>(path);
    return <Box component="section" sx={{ mb: 3 }}>
        <Typography variant="h6">{title}</Typography>
        {data ? <>
            <Typography color="text.secondary" variant="body2">{data.points.reduce((sum, point) => sum + point.count, 0).toLocaleString()} {unit} in selected period</Typography>
            <ActivityChart points={data.points} unit={unit} />
        </> : <LoadState error={error} retry={retry} />}
    </Box>;
}

function ActivityChart({ points, unit }: { points: Point[]; unit: string }) {
    const max = Math.max(1, ...points.map(point => point.count));
    const x = (index: number) => 65 + index * 690 / Math.max(1, points.length - 1);
    const y = (count: number) => 215 - count / max * 180;
    return <Box sx={{ overflowX: 'auto', mt: 2 }}>
        {!points.some(point => point.count > 0) && <Typography color="text.secondary" variant="body2">No {unit} in this period.</Typography>}
        <Box component="svg" viewBox="0 0 800 260" role="img" aria-label={`${unit} by date; focus a point or hover for its value.`} sx={{ width: '100%', minWidth: 500, display: 'block', color: 'primary.main', '& circle:focus': { outline: 'none', stroke: 'white', strokeWidth: 3 } }}>
            {[0, 0.5, 1].map(fraction => <g key={fraction}>
                <line x1="65" x2="755" y1={y(max * fraction)} y2={y(max * fraction)} stroke="currentColor" opacity="0.15" />
                <text x="55" y={y(max * fraction) + 4} textAnchor="end" fill="#94A3B8" fontSize="12">{Math.round(max * fraction).toLocaleString()}</text>
            </g>)}
            <polyline points={points.map((point, index) => `${x(index)},${y(point.count)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />
            {points.map((point, index) => <g key={point.date}>
                <circle cx={x(index)} cy={y(point.count)} r="4" fill="currentColor" tabIndex={0} aria-label={`${point.date}: ${point.count} ${unit}`}><title>{point.date}: {point.count.toLocaleString()} {unit}</title></circle>
                {(index === 0 || index === points.length - 1) && <text x={x(index)} y="245" textAnchor={index === 0 ? 'start' : 'end'} fill="#94A3B8" fontSize="12">{point.date}</text>}
            </g>)}
        </Box>
    </Box>;
}
