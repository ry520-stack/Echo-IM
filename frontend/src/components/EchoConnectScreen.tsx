type EchoConnectScreenProps = {
  failed?: boolean;
  onRetry?: () => void;
  onDemo?: () => void;
};

export default function EchoConnectScreen({ failed = false, onRetry, onDemo }: EchoConnectScreenProps) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#F8FAFC] px-6 text-[#111827]">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(99,102,241,0.12)] blur-3xl" />
      <main className="relative z-10 flex flex-1 items-center justify-center">
        <section className="w-full max-w-[320px] rounded-[28px] bg-white p-7 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-3xl font-black text-white shadow-[0_12px_28px_rgba(99,102,241,0.22)]">
            E
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight">Echo</h1>
          <p className="mt-2 text-sm font-medium text-[#6B7280]">轻量级即时通讯空间</p>

          <div className="mt-7 flex flex-col items-center">
            <p className="text-sm font-medium text-[#6B7280]">
              {failed ? '连接服务失败' : '正在连接服务...'}
            </p>
            {!failed ? (
              <div className="mt-4 h-1 w-[180px] overflow-hidden rounded-full bg-[#E5E7EB]">
                <div className="h-full w-1/2 animate-[echoProgress_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]" />
              </div>
            ) : (
              <div className="mt-5 flex justify-center gap-2">
                <button onClick={onRetry || (() => location.reload())} className="h-10 rounded-[14px] bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-5 text-sm font-semibold text-white shadow-sm">
                  重试
                </button>
                <button onClick={onDemo || (() => location.assign('/#/login'))} className="h-10 rounded-[14px] border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#374151]">
                  体验模式
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
      <footer className="relative z-10 pb-6 text-center text-xs font-medium text-[#9CA3AF]">
        Echo IM · Modern Communication Platform
      </footer>
    </div>
  );
}
