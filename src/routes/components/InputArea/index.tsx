import { QUICK_PROMPTS } from '@/constants/chat';
import {
  AppstoreOutlined,
  ArrowUpOutlined,
  AudioOutlined,
  BookOutlined,
  DownloadOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';
import { Prompts, Sender } from '@ant-design/x';
import { Button } from 'antd';
import React, { useState } from 'react';
import './InputArea.less';

const iconMap: Record<string, React.ReactNode> = {
  ArrowUpOutlined: <ArrowUpOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  BookOutlined: <BookOutlined />,
  DownloadOutlined: <DownloadOutlined />,
};

export interface InputAreaProps {
  onSend: (content: string) => void;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend }) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const content = value.trim();
    if (!content) return;
    onSend(content);
    setValue('');
  };

  const promptsItems = QUICK_PROMPTS.map(prompt => ({
    key: prompt.id,
    icon: prompt.icon ? iconMap[prompt.icon] : undefined,
    label: prompt.text,
  }));

  return (
    <div className="input-area-container">
      <div className="prompts-wrapper">
        <Prompts
          items={promptsItems}
          onItemClick={info => {
            const prompt = QUICK_PROMPTS.find(p => p.id === info.data.key);
            if (prompt) {
              setValue(prompt.text);
            }
          }}
          wrap
        />
      </div>
      <div className="sender-wrapper">
        <Sender
          value={value}
          onChange={setValue}
          onSubmit={handleSend}
          placeholder="提问或输入 / 使用技能"
          prefix={
            <Button
              type="text"
              icon={<PaperClipOutlined />}
              className="sender-icon-btn"
            />
          }
          suffix={
            <div className="sender-actions">
              <Button
                type="text"
                icon={<AudioOutlined />}
                className="sender-icon-btn"
              />
              <Button
                type="primary"
                shape="circle"
                icon={<ArrowUpOutlined />}
                onClick={handleSend}
                disabled={!value.trim()}
                className="sender-send-btn"
                aria-label="发送"
              />
            </div>
          }
        />
      </div>
    </div>
  );
};

export default InputArea;
