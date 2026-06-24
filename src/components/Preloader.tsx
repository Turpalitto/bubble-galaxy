/**
 * Preloader — загрузочный экран, показывается пока игра не инициализирует SDK
 * и не загрузит все ресурсы. Соответствует требованиям Яндекс Игр:
 * - Не пустой экран во время загрузки
 * - Плавный переход к игре
 */
export default function Preloader() {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0d0221 0%, #1a0533 50%, #0a1628 100%)',
      }}
    >
      {/* Фоновые частицы (имитация пузырей) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              width: `${15 + Math.random() * 25}px`,
              height: `${15 + Math.random() * 25}px`,
              left: `${Math.random() * 100}%`,
              bottom: `-${20 + Math.random() * 30}px`,
              background: `radial-gradient(circle at 35% 35%, 
                ${['rgba(255,59,92,0.3)', 'rgba(255,149,0,0.3)', 'rgba(52,199,89,0.3)', 
                   'rgba(0,122,255,0.3)', 'rgba(175,82,222,0.3)', 'rgba(255,204,0,0.3)'][i % 6]},
                transparent)`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Логотип */}
      <div className="relative z-10 text-center">
        <div className="text-4xl font-black tracking-tight bg-gradient-to-r from-fuchsia-400 via-purple-400 to-sky-400 bg-clip-text text-transparent">
          BUBBLE
        </div>
        <div className="text-4xl font-black tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 bg-clip-text text-transparent">
          GALAXY
        </div>
      </div>

      {/* Индикатор загрузки */}
      <div className="relative z-10 mt-8">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
      </div>

      <p className="relative z-10 mt-4 text-purple-500/70 text-sm font-medium tracking-wider">
        Загрузка…
      </p>
    </div>
  );
}
