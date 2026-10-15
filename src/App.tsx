import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ANIMALS } from './data/animals';
import { AnimalInfo, GameMode } from './types';
import { audioManager } from './utils/audio';
import { Navbar } from './components/Navbar';
import { AnimalStage } from './components/AnimalStage';
import { ParadeNav } from './components/ParadeNav';
import { QuizMode } from './components/QuizMode';
import { SoundboardMode } from './components/SoundboardMode';
import { ParentModal } from './components/ParentModal';

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [selectedHabitat, setSelectedHabitat] = useState('all');
  const [mode, setMode] = useState<GameMode>('safari');
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [isParentModalOpen, setIsParentModalOpen] = useState(false);

  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentAnimal = ANIMALS[currentIndex] || ANIMALS[0];

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const clearAutoTimer = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };

  const triggerAnimalSound = useCallback(
    (animal: AnimalInfo, shouldAutoAdvance: boolean) => {
      clearAutoTimer();
      setIsSpeaking(true);

      audioManager.playAnimalSound(
        animal.soundFile,
        () => {
          // Sound finished
          setIsSpeaking(false);

          // Transition to a DIFFERENT animal as requested
          if (shouldAutoAdvance) {
            autoAdvanceTimerRef.current = setTimeout(() => {
              setCurrentIndex((prev) => (prev + 1) % ANIMALS.length);
            }, 800);
          }
        },
        () => {
          setIsSpeaking(true);
        }
      );
    },
    []
  );

  const handleNextAnimal = useCallback(
    (andPlay = true) => {
      clearAutoTimer();
      setIsSpeaking(false);
      audioManager.stopCurrent();

      setCurrentIndex((prev) => {
        const nextIdx = (prev + 1) % ANIMALS.length;
        if (andPlay) {
          setTimeout(() => {
            triggerAnimalSound(ANIMALS[nextIdx], autoAdvance);
          }, 80);
        }
        return nextIdx;
      });
    },
    [autoAdvance, triggerAnimalSound]
  );

  const handlePrevAnimal = useCallback(
    (andPlay = true) => {
      clearAutoTimer();
      setIsSpeaking(false);
      audioManager.stopCurrent();

      setCurrentIndex((prev) => {
        const prevIdx = (prev - 1 + ANIMALS.length) % ANIMALS.length;
        if (andPlay) {
          setTimeout(() => {
            triggerAnimalSound(ANIMALS[prevIdx], autoAdvance);
          }, 80);
        }
        return prevIdx;
      });
    },
    [autoAdvance, triggerAnimalSound]
  );

  const handleRandomAnimal = useCallback(() => {
    clearAutoTimer();
    setIsSpeaking(false);
    audioManager.stopCurrent();

    setCurrentIndex((prev) => {
      let nextIdx = Math.floor(Math.random() * ANIMALS.length);
      if (nextIdx === prev) {
        nextIdx = (nextIdx + 1) % ANIMALS.length;
      }
      setTimeout(() => {
        triggerAnimalSound(ANIMALS[nextIdx], autoAdvance);
      }, 80);
      return nextIdx;
    });
  }, [autoAdvance, triggerAnimalSound]);

  const handleSelectAnimal = (animal: AnimalInfo) => {
    const idx = ANIMALS.findIndex((a) => a.id === animal.id);
    if (idx !== -1) {
      clearAutoTimer();
      setIsSpeaking(false);
      audioManager.stopCurrent();
      setCurrentIndex(idx);
      setTimeout(() => {
        triggerAnimalSound(animal, autoAdvance);
      }, 100);
    }
  };

  // When child taps the animal:
  const handleStageClick = () => {
    // If already speaking, skip immediately to the next animal!
    if (isSpeaking) {
      handleNextAnimal(true);
      return;
    }

    // Play current animal and queue the next animal
    triggerAnimalSound(currentAnimal, true);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      audioManager.setVolume(volume);
      setIsMuted(false);
    } else {
      audioManager.setVolume(0);
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    if (!isMuted) {
      audioManager.setVolume(newVal);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'safari') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextAnimal(true);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevAnimal(true);
      } else if (e.key === ' ') {
        e.preventDefault();
        handleStageClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, isSpeaking, currentAnimal, handleNextAnimal, handlePrevAnimal]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 via-orange-50/50 to-amber-100/60 flex flex-col justify-between selection:bg-amber-200">
      {/* Top Bar Navigation */}
      <Navbar
        mode={mode}
        onSetMode={(m) => {
          clearAutoTimer();
          setIsSpeaking(false);
          audioManager.stopCurrent();
          setMode(m);
        }}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenHelp={() => setIsParentModalOpen(true)}
      />

      {/* Main Content Area based on Mode */}
      <main className="flex-1 flex flex-col items-center justify-center py-4">
        {mode === 'safari' && (
          <div className="w-full flex flex-col items-center">
            {/* Primary Animal Stage */}
            <AnimalStage
              animal={currentAnimal}
              isSpeaking={isSpeaking}
              onPlaySound={handleStageClick}
              onNextAnimal={() => handleNextAnimal(true)}
              onPrevAnimal={() => handlePrevAnimal(true)}
              onRandomAnimal={handleRandomAnimal}
              autoAdvance={autoAdvance}
              onToggleAutoAdvance={() => setAutoAdvance(!autoAdvance)}
            />

            {/* Bottom Parade of 16 Animals */}
            <ParadeNav
              animals={ANIMALS}
              currentAnimalId={currentAnimal.id}
              onSelectAnimal={handleSelectAnimal}
              selectedHabitat={selectedHabitat}
              onSelectHabitat={setSelectedHabitat}
            />
          </div>
        )}

        {mode === 'quiz' && (
          <div className="w-full">
            <QuizMode animals={ANIMALS} onPlaySound={(a) => triggerAnimalSound(a, false)} />
          </div>
        )}

        {mode === 'soundboard' && (
          <div className="w-full">
            <SoundboardMode animals={ANIMALS} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-amber-200/60 bg-white/60 py-3 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Animal Friends · 16 Real Animal Vocalizations &amp; Animations</span>
          <span>Tap any animal to hear its voice! 🐾</span>
        </div>
      </footer>

      {/* Parent & Sound Settings Modal */}
      <ParentModal
        isOpen={isParentModalOpen}
        onClose={() => setIsParentModalOpen(false)}
        narrationEnabled={false}
        onToggleNarration={() => {}}
        volume={volume}
        onVolumeChange={handleVolumeChange}
      />
    </div>
  );
}
