'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Field, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { ProfileForm } from '@/components/admin/profile-form';

export default function ProfilePage() {
  const { me, loading } = useAuth();
  const { href } = useI18n();
  const router = useRouter();
  useEffect(() => { if (!loading && !me) router.replace(href('/login')); }, [loading, me, router, href]);
  if (loading || !me) return <Center><Spinner /></Center>;
  return <div className="mx-auto max-w-3xl px-4 py-8"><ProfileForm /></div>;
}
