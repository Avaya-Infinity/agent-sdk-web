import { useState } from 'react';
import { OAuthMode } from '@avaya/infinity-agent-sdk';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { strings } from '@/locales/en';

/**
 * Configuration interface for SDK initialization
 */
export interface Config {
  avayaInfinityHost: string;
  clientId: string;
  oAuthMode: OAuthMode;
  redirectUri: string;
  idpHint?: string;
}

interface SettingsProps {
  onSubmit: (config: Config) => void;
  error: string | null;
}

/**
 * Settings Component
 * 
 * Allows users to configure the Avaya Infinity host and OAuth Client ID
 * required for SDK authentication.
 */
function Settings({ onSubmit, error }: SettingsProps) {
  const [formData, setFormData] = useState<Config>({
    avayaInfinityHost: '',
    clientId: '',
    oAuthMode: OAuthMode.REDIRECT,
    redirectUri: '',
    idpHint: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleOAuthModeChange = (mode: OAuthMode) => {
    setFormData({
      ...formData,
      oAuthMode: mode
    });
  };

  return (
    <div className="flex justify-center items-center min-h-screen w-full p-5 bg-gray-50">
      <div className="bg-white p-10 border border-gray-200 rounded-lg max-w-md w-full">
        <h1 className="text-2xl font-semibold text-center text-black mb-2">
          {strings.settings.title}
        </h1>
        <p className="text-gray-500 text-sm text-center mb-8">
          {strings.settings.subtitle}
        </p>
        
        {error && (
          <div 
            className="bg-red-50 text-red-600 p-3 border border-red-200 rounded mb-5 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <Label htmlFor="avayaInfinityHost" className="block mb-2 text-black text-sm font-medium">
              {strings.settings.hostLabel}
            </Label>
            <Input
              type="text"
              id="avayaInfinityHost"
              name="avayaInfinityHost"
              value={formData.avayaInfinityHost}
              onChange={handleInputChange}
              placeholder={strings.settings.hostPlaceholder}
              required
              className="w-full"
            />
          </div>
          
          <div className="mb-5">
            <Label htmlFor="clientId" className="block mb-2 text-black text-sm font-medium">
              {strings.settings.clientIdLabel}
            </Label>
            <Input
              type="text"
              id="clientId"
              name="clientId"
              value={formData.clientId}
              onChange={handleInputChange}
              placeholder={strings.settings.clientIdPlaceholder}
              required
              className="w-full"
            />
          </div>

          <div className="mb-5">
            <Label htmlFor="redirectUri" className="block mb-2 text-black text-sm font-medium">
              {strings.settings.redirectUriLabel}
            </Label>
            <Input
              type="text"
              id="redirectUri"
              name="redirectUri"
              value={formData.redirectUri}
              onChange={handleInputChange}
              placeholder={strings.settings.redirectUriPlaceholder}
              required
              className="w-full"
            />
          </div>

          <div className="mb-5">
            <Label className="block mb-2 text-black text-sm font-medium">
              {strings.settings.oAuthModeLabel}
            </Label>
            <div className="flex gap-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="oAuthMode"
                  value="redirect"
                  checked={formData.oAuthMode === OAuthMode.REDIRECT}
                  onChange={() => handleOAuthModeChange(OAuthMode.REDIRECT)}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-black">{strings.settings.oAuthModeRedirect}</span>
                  <p className="text-xs text-gray-500">{strings.settings.oAuthModeRedirectDescription}</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="oAuthMode"
                  value="popup"
                  checked={formData.oAuthMode === OAuthMode.POPUP}
                  onChange={() => handleOAuthModeChange(OAuthMode.POPUP)}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-black">{strings.settings.oAuthModePopup}</span>
                  <p className="text-xs text-gray-500">{strings.settings.oAuthModePopupDescription}</p>
                </div>
              </label>
            </div>
          </div>

          <div className="mb-5">
            <Label htmlFor="idpHint" className="block mb-2 text-black text-sm font-medium">
              {strings.settings.idpHintLabel}
            </Label>
            <Input
              type="text"
              id="idpHint"
              name="idpHint"
              value={formData.idpHint ?? ''}
              onChange={handleInputChange}
              placeholder={strings.settings.idpHintPlaceholder}
              className="w-full"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {strings.settings.idpHintDescription}
            </p>
          </div>

          <Button type="submit" className="w-full mt-2">
            {strings.settings.submitButton}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default Settings;
