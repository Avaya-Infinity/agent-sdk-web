import { useState, useEffect, useRef } from 'react';
import { X, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DTMF_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const DTMF_LETTERS: Record<string, string> = {
  '1': '', '2': 'ABC', '3': 'DEF',
  '4': 'GHI', '5': 'JKL', '6': 'MNO',
  '7': 'PQRS', '8': 'TUV', '9': 'WXYZ',
  '*': '', '0': '+', '#': '',
};

interface DtmfDialPadProps {
  onDigitPress: (digit: string) => void;
  onClose: () => void;
  showInput?: boolean;
}

function DtmfDialPad({ onDigitPress, onClose, showInput = true }: DtmfDialPadProps) {
  const [input, setInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDigitPress = (digit: string) => {
    if (showInput) setInput((prev) => prev + digit);
    onDigitPress(digit);
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, [input]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputOrTextarea = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isOutsideDialPad = !containerRef.current?.contains(target);
      if (isInputOrTextarea && isOutsideDialPad) return;
      if (DTMF_DIGITS.includes(e.key)) {
        handleDigitPress(e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDigitPress, showInput]);

  const handleClose = () => {
    setInput('');
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-2 w-[190px]"
      role="group"
      aria-label="DTMF dial pad"
    >
      {/* Header: input (optional) + close button */}
      <div className="flex items-center gap-1 mb-2">
        {showInput && (
          <div className="flex items-center flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-2.5 h-9">
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={input}
              className="flex-1 min-w-0 bg-transparent font-mono text-base font-semibold text-gray-900 outline-none select-none"
              tabIndex={-1}
              aria-label="DTMF digits entered"
              placeholder="..."
            />
            {input.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 ml-1 shrink-0"
                onClick={() => setInput('')}
                aria-label="Clear DTMF input"
              >
                <Delete className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 shrink-0 ml-auto"
          onClick={handleClose}
          aria-label="Close dial pad"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {/* 3×4 digit grid */}
      <div className="grid grid-cols-3 gap-1">
        {DTMF_DIGITS.map((digit) => (
          <Button
            key={digit}
            variant="secondary"
            className="w-full h-11 rounded-lg bg-gray-100 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 flex flex-col items-center justify-center gap-0 p-0"
            onClick={() => handleDigitPress(digit)}
            aria-label={`Send DTMF ${digit}`}
          >
            <span className="text-base font-semibold text-gray-900 leading-tight">{digit}</span>
            {DTMF_LETTERS[digit] && (
              <span className="text-[9px] text-gray-400 tracking-widest uppercase leading-tight">
                {DTMF_LETTERS[digit]}
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}

export { DtmfDialPad };
