// 管理员登录 / 注册。注册需邀请码（走 verify-invite 服务端校验，前端不接触真实码）。
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { verifyInvite } from '../lib/api';
import { Button, Toast } from '../components/ui';
import { useToast } from '../lib/useToast';

export default function AdminLoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, showSuccess, showError } = useToast();
  const navigate = useNavigate();

  async function handleLogin() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? '邮箱或密码错误' : error.message);
      navigate('/admin');
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    if (password !== confirm) return showError('两次输入的密码不一致');
    if (password.length < 6) return showError('密码长度至少 6 位');
    setBusy(true);
    try {
      const valid = await verifyInvite(invite);
      if (!valid) throw new Error('邀请码不正确');
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      showSuccess('注册成功！请到邮箱查收确认邮件，确认后即可登录。');
      setMode('login');
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark to-brand flex items-center justify-center px-4">
      <Toast msg={toast.msg} type={toast.type} />
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-slate-800">体育赛事管理系统</h1>
          <p className="text-sm text-slate-400 mt-1">{mode === 'login' ? '管理员登录' : '注册新管理员'}</p>
        </div>

        <div className="space-y-3">
          <Field label="邮箱" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Field label="密码" type="password" value={password} onChange={setPassword} placeholder="至少 6 位" />
          {mode === 'register' && (
            <>
              <Field label="确认密码" type="password" value={confirm} onChange={setConfirm} />
              <Field label="邀请码" value={invite} onChange={setInvite} placeholder="向超级管理员索取" />
            </>
          )}
        </div>

        <div className="mt-6">
          <Button
            className="w-full"
            disabled={busy || !email || !password}
            onClick={mode === 'login' ? handleLogin : handleRegister}
          >
            {busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </Button>
        </div>

        <p className="text-center text-sm text-slate-400 mt-4">
          {mode === 'login' ? (
            <>还没有账号？<button className="text-brand hover:underline" onClick={() => setMode('register')}>注册</button></>
          ) : (
            <>已有账号？<button className="text-brand hover:underline" onClick={() => setMode('login')}>登录</button></>
          )}
        </p>
        <p className="text-center text-xs text-slate-300 mt-4">
          <Link to="/" className="hover:underline">← 返回前台</Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-500">{label}</span>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-brand"
      />
    </label>
  );
}
