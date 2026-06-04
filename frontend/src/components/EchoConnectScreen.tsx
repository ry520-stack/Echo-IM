type EchoConnectScreenProps = {
  failed?: boolean;
  onRetry?: () => void;
  onDemo?: () => void;
};

export default function EchoConnectScreen({ failed = false, onRetry, onDemo }: EchoConnectScreenProps) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-[#F8FAFC] px-6 text-[#111827]">
      <main className="flex flex-1 items-center justify-center">
        <section className="w-full max-w-sm rounded-[28px] border border-white/80 bg-white/75 p-7 text-center shadow-[0_24px_80px_rgba(99,102,241,0.14)] backdrop-blur">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-4xl font-black text-white shadow-[0_18px_44px_rgba(99,102,241,0.32)]">
            E
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight">Echo</h1>
          <p className="mt-3 text-base font-semibold text-[#111827]">新一代轻量级即时通讯空间</p>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">连接团队、朋友与每一次对话</p>

          <div className="mt-8 rounded-[20px] bg-[#F7F8FA] p-4">
            <p className="text-sm font-semibold text-[#6B7280]">
              {failed ? 'Echo 服务连接失败' : '正在连接 Echo 服务...'}
            </p>
            {!failed ? (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-indigo-100">
                  <div className="h-full w-1/2 animate-[echoProgress_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6]" />
                </div>
                <div className="mt-4 flex justify-center gap-1.5">
                  <span className="h-2 w-2 animate-[echoDot_1s_ease-in-out_infinite] rounded-full bg-[#6366F1]" />
                  <span className="h-2 w-2 animate-[echoDot_1s_ease-in-out_0.15s_infinite] rounded-full bg-[#7C3AED]" />
                  <span className="h-2 w-2 animate-[echoDot_1s_ease-in-out_0.3s_infinite] rounded-full bg-[#8B5CF6]" />
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={onRetry || (() => location.reload())} className="h-12 rounded-[14px] bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-sm font-bold text-white shadow-lg shadow-indigo-200">
                  重试
                </button>
                <button onClick={onDemo || (() => location.assign('/#/login'))} className="h-12 rounded-[14px] bg-indigo-50 text-sm font-bold text-[#6366F1]">
                  进入体验模式
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
      <footer className="pb-7 text-center text-xs font-medium text-[#6B7280]">
        Echo IM · Real-time Communication Platform
      </footer>
    </div>
  );
}
