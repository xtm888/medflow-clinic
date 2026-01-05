/**
 * SettingsSidebar Component
 *
 * Navigation sidebar for settings tabs.
 * Supports both internal tabs and external navigation links.
 */

import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

export default function SettingsSidebar({ tabs, activeTab, onTabChange }) {
  const navigate = useNavigate();

  const handleTabClick = (tab) => {
    if (tab.navigateTo) {
      // External navigation to a different page
      navigate(tab.navigateTo);
    } else {
      // Internal tab change
      onTabChange(tab.id);
    }
  };

  return (
    <div className="lg:col-span-1">
      <div className="card p-0">
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span className="font-medium flex-1">{tab.label}</span>
              {tab.navigateTo && (
                <ExternalLink className="h-4 w-4 text-gray-400" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
