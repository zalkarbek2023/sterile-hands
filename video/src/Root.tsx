import React from 'react';
import {Composition} from 'remotion';
import {Post, TOTAL} from './Post';

export const Root: React.FC = () => (
  <Composition id="Post" component={Post} durationInFrames={TOTAL} fps={30} width={1080} height={1350} />
);
