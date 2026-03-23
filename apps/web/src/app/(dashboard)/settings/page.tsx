'use client';

import { auth } from '@/lib/api';

export default function SettingsPage() {
  const user = auth.getUser();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Name</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {user?.firstName} {user?.lastName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Email</span>
            <span className="text-gray-900 dark:text-white">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Role</span>
            <span className="text-gray-900 dark:text-white capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Site</span>
            <span className="text-gray-900 dark:text-white">{user?.siteName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Organization</span>
            <span className="text-gray-900 dark:text-white">{user?.corporateName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
