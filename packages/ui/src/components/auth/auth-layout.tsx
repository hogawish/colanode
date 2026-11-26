import { Outlet } from '@tanstack/react-router';
import { useState } from 'react';

import { Server } from '@colanode/client/types';
import { AuthCancel } from '@colanode/ui/components/auth/auth-cancel';
import { AuthServer } from '@colanode/ui/components/auth/auth-server';
import { ColanodeLogo } from '@colanode/ui/components/ui/logo';
import { AuthContext } from '@colanode/ui/contexts/auth';

export const AuthLayout = () => {
  const [server, setServer] = useState<Server | null>(null);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center">
      <AuthCancel />
      <div className="w-full flex lg:flex-row flex-col items-center justify-center lg:gap-40 gap-20">
        <div className="flex flex-col items-center justify-center bg-background px-6 py-12">
          <div className="flex flex-row items-center gap-6">
            <div className="logo-draw-animation">
              <ColanodeLogo className="size-16 lg:size-50" />
            </div>
            <div>
              <h1 className="font-satoshi text-4xl font-semibold tracking-tight">
                Tsuzunowa
              </h1>
              <p className="mt-3 text-lg text-muted-foreground">
                One original. <br /> Many ways to work together.
              </p>
            </div>
          </div>
        </div>

        <div className="w-96 max-w-xl flex flex-col items-center justify-center bg-background">
          {server ? (
            <AuthContext.Provider value={{ server }}>
              <Outlet />
            </AuthContext.Provider>
          ) : (
            <AuthServer onSelect={setServer} />
          )}
        </div>
      </div>
    </div>
  );
};
