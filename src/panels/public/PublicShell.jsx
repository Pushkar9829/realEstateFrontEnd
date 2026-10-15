import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut } from 'lucide-react';
import PublicLayout from '@/shared/layouts/PublicLayout';
import { Avatar, Button } from '@/shared/ui';
import { useAuth } from '@/modules/auth';
import { useCities } from '@/modules/listings/api';
import { usePublicSettings } from '@/modules/search/api';
import { captureReferral, useCityPref } from '@/modules/search/prefs';
import { CitySelect, ShortlistIcon } from './components/HeaderBits';

// Public layout with the signed-in state, the city selector and shortlist
// count in the header, public settings for the footer and cookie banner, and
// referral capture from `?ref=CODE` on any public URL (RE-N-01).
export default function PublicShell() {
  const { isAuthed, user, home, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = usePublicSettings();
  const citiesQ = useCities();
  const [cityPref, setCityPref] = useCityPref();
  const s = settings.data;
  const refDays = (s && s.referral && s.referral.captureDays) || 30;

  useEffect(() => { captureReferral(location.search, refDays); }, [location.search, refDays]);

  const cities = citiesQ.data || [];
  const city = cities.find((c) => [c.code, c.name].includes(cityPref)) || null;
  const cityPicker = <CitySelect cities={cities} value={city ? city.code : ''} onChange={setCityPref} className="w-40" />;

  const account = isAuthed ? (
    <div className="flex items-center gap-2">
      {home !== '/' && <Button variant="secondary" size="sm" icon={LayoutDashboard} to={home}>My panel</Button>}
      <Button variant="ghost" size="sm" to={home === '/' ? '/account' : `${home}/account`} className="gap-2"><Avatar name={user.name} size="sm" /><span className="hidden lg:inline">{user.name.split(' ')[0]}</span></Button>
      <Button variant="ghost" size="sm" icon={LogOut} onClick={async () => { await logout(); navigate('/'); }} aria-label="Log out" />
    </div>
  ) : null;
  return (
    <PublicLayout account={account} settings={s} settingsReady={!settings.isLoading} city={city}
      cityPicker={cities.length ? cityPicker : null} shortlist={<ShortlistIcon />} />
  );
}
