import { useEffect, useState } from 'react';
import { MoreHorizontal, Search, ShieldCheck, UserRound } from 'lucide-react';

import { useToast } from '../../components/Toast';
import { Alert, Avatar, Badge, Button, Card, EmptyState, Input, Menu, PageHeader, Pagination, Skeleton } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatDate, formatRelative } from '../../lib/format';
import { useAdminUsers, useSetUserRole } from '../../lib/queries';
import { useAppSelector } from '../../store';

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AdminUsersPage() {
  const toast = useToast();
  const me = useAppSelector((state) => state.auth.user);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const users = useAdminUsers({ page, search: debouncedSearch || undefined });
  const setRole = useSetUserRole();

  useEffect(() => setPage(1), [debouncedSearch]);

  const changeRole = async (id: string, role: 'ADMIN' | 'CUSTOMER', name: string) => {
    try {
      await setRole.mutateAsync({ id, role });
      toast.success('Role updated', `${name} is now ${role === 'ADMIN' ? 'an admin' : 'a customer'}.`);
    } catch (error) {
      toast.error('Could not change role', errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone with a Ledgerly login." />
      {users.isError && <Alert>{errorMessage(users.error)}</Alert>}
      <Card>
        <div className="filters">
          <Input icon={<Search />} placeholder="Search by name or email" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search customers" />
        </div>
        <div className="table-wrap" style={{ opacity: users.isPlaceholderData ? 0.6 : 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Role</th>
                <th>Accounts</th>
                <th>Last sign-in</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.isLoading
                ? Array.from({ length: 6 }, (_, index) => (
                    <tr key={index}>
                      <td colSpan={6}><Skeleton height={28} /></td>
                    </tr>
                  ))
                : users.data?.items.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="table-cell-main">
                          <Avatar name={user.fullName} size="sm" />
                          <div style={{ minWidth: 0 }}>
                            <div className="strong ellipsis">{user.fullName}</div>
                            <div className="small muted ellipsis">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{user.role === 'ADMIN' ? <Badge tone="primary">Admin</Badge> : <Badge>Customer</Badge>}</td>
                      <td className="num">{user.accountsCount}</td>
                      <td className="muted nowrap">{formatRelative(user.lastLoginAt)}</td>
                      <td className="muted nowrap">{formatDate(user.createdAt)}</td>
                      <td className="align-right">
                        {user.id !== me?.id && (
                          <Menu trigger={(props) => <Button variant="ghost" size="sm" icon={<MoreHorizontal />} aria-label={`Actions for ${user.fullName}`} {...props} />}>
                            {(close) =>
                              user.role === 'ADMIN' ? (
                                <button type="button" className="menu-item" onClick={() => { close(); void changeRole(user.id, 'CUSTOMER', user.fullName); }}>
                                  <UserRound /> Make customer
                                </button>
                              ) : (
                                <button type="button" className="menu-item" onClick={() => { close(); void changeRole(user.id, 'ADMIN', user.fullName); }}>
                                  <ShieldCheck /> Make admin
                                </button>
                              )
                            }
                          </Menu>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {users.data?.items.length === 0 && <EmptyState icon={<Search />} title="No customers match your search" />}
        {users.data && users.data.meta.total > 0 && (
          <Pagination page={page} totalPages={users.data.meta.totalPages} total={users.data.meta.total} onPage={setPage} noun="customers" />
        )}
      </Card>
    </>
  );
}
