"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface CookieManagerProps {
  onCookiesReady: (cookies: string) => void;
  onClose: () => void;
}

export function CookieManager({ onCookiesReady, onClose }: CookieManagerProps) {
  const [cookieInput, setCookieInput] = useState('');

  const handleConfirm = () => {
    if (cookieInput.trim()) {
      onCookiesReady(cookieInput.trim());
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Cookie Authentication</CardTitle>
        <CardDescription>
          The content you are trying to access requires authentication. Please provide your browser cookies for the platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="cookie-input">Cookie String</Label>
            <Textarea
              id="cookie-input"
              placeholder="Paste your cookie string here..."
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} disabled={!cookieInput.trim()}>Confirm</Button>
      </CardFooter>
    </Card>
  );
}
