import { NavLink } from 'react-router-dom';
import './TabBar.css';

const tabs = [
  { to: '/', label: 'Лента', icon: '🏠', end: true },
  { to: '/create', label: 'Создать', icon: '➕', end: false },
  { to: '/profile', label: 'Профиль', icon: '👤', end: false },
];

export function TabBar() {
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `tab-bar__item${isActive ? ' tab-bar__item--active' : ''}`}
        >
          <span className="tab-bar__icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
