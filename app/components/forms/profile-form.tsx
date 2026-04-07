'use client'
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EditUserProfileSchema } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Props = {
  user: {
    name?: string | null;
    email?: string | null;
    [k: string]: any;
  } | null | undefined;
  onUpdate?: (name: string) => Promise<any> | any;
};

// Small local toast/snackbar component (self-contained)
const Toast: React.FC<{ message: string; type?: 'success' | 'error'; onClose: () => void }> = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const t = setTimeout(() => onClose(), 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const bg = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-4 bottom-6 z-50 rounded-md px-4 py-2 text-sm text-white shadow-lg ${bg}`}
    >
      {message}
    </div>
  );
};

const ProfileForm: React.FC<Props> = ({ user, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null);

  const form = useForm<z.infer<typeof EditUserProfileSchema>>({
    mode: 'onChange',
    resolver: zodResolver(EditUserProfileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
    },
  });

  const handleSubmit = async (values: z.infer<typeof EditUserProfileSchema>) => {
    setIsLoading(true);
    try {
      if (typeof onUpdate === 'function') {
        await onUpdate(values.name);
        setToast({ msg: 'Profile updated successfully', type: 'success' });
      } else {
        console.warn('ProfileForm: onUpdate is not a function');
        setToast({ msg: 'Profile updated (local)', type: 'success' });
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const message = error?.message ?? String(error) ?? 'Failed to update profile';
      setToast({ msg: `Error: ${message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? '',
        email: user.email ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Accessibility: if user not yet available, show a simple placeholder
  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading user data...</span>
      </div>
    );
  }

  return (
    <>
      <Form {...form}>
        <form
          className="flex flex-col gap-6"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <FormField
            disabled={isLoading}
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg">User full name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter your full name"
                    aria-label="Full name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg">Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled
                    placeholder="Email"
                    type="email"
                    aria-label="Email address"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isLoading}
            className="self-start bg-[#DDDDDD] text-black hover:bg-[#2F006B] hover:text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              'Save User Settings'
            )}
          </Button>
        </form>
      </Form>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type ?? 'success'}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};

export default ProfileForm;
