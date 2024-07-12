import * as React from 'react';

import {
  BaseLink,
  Button,
  Field,
  FieldInput,
  FieldLabel,
  Flex,
  Popover,
  Typography,
} from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { Editor, Path, Range, Transforms, select } from 'slate';
import { type RenderElementProps, ReactEditor } from 'slate-react';
import styled from 'styled-components';

import { composeRefs } from '../../../utils/refs';
import { type BlocksStore, useBlocksEditorContext } from '../BlocksEditor';
import { editLink, removeLink } from '../utils/links';
import { isLinkNode, type Block } from '../utils/types';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: '', dangerouslyAllowBrowser: true });

const StyledBaseLink = styled(BaseLink)`
  text-decoration: none;
`;

const RemoveButton = styled(Button) <{ visible: boolean }>`
  visibility: ${(props) => (props.visible ? 'visible' : 'hidden')};
`;

interface LinkContentProps extends RenderElementProps {
  link: Block<'link'>;
}

const LinkContent = React.forwardRef<HTMLAnchorElement, LinkContentProps>(
  ({ link, children, attributes }, forwardedRef) => {
    const { formatMessage } = useIntl();
    const { editor } = useBlocksEditorContext('Link');
    const path = ReactEditor.findPath(editor, link);
    const [popoverOpen, setPopoverOpen] = React.useState(
      editor.lastInsertedLinkPath ? Path.equals(path, editor.lastInsertedLinkPath) : false
    );
    const linkRef = React.useRef<HTMLAnchorElement>(null!);
    const elementText = link.children.map((child) => child.text).join('');
    const [selectedText, setSelectedText] = React.useState(elementText);
    const [linkUrl, setLinkUrl] = React.useState(link.url);
    const [userPrompt, setUserPrompt] = React.useState('');
    const linkInputRef = React.useRef<HTMLInputElement>(null);
    const [showRemoveButton, setShowRemoveButton] = React.useState(false);
    const [isSaveDisabled, setIsSaveDisabled] = React.useState(false);
    const [aiGeneratedContent, setAIgeneratedContent] = React.useState('');

    const handleOpenEditPopover: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
      e.preventDefault();
      setPopoverOpen(true);
      setShowRemoveButton(true);
    };

    const onLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsSaveDisabled(false);
      setLinkUrl(e.target.value);

      try {
        // eslint-disable-next-line no-new
        new URL(
          e.target.value?.startsWith('/') ? `https://strapi.io${e.target.value}` : e.target.value
        );
      } catch (error) {
        setIsSaveDisabled(true);
      }
    };

    const handleSave: React.FormEventHandler = (e) => {
      e.stopPropagation();
      e.preventDefault();
      requestAI(`${userPrompt}: ${selectedText}`);

      // If the selection is collapsed, we select the parent node because we want all the link to be replaced)
      /* if (editor.selection && Range.isCollapsed(editor.selection)) {
        const [, parentPath] = Editor.parent(editor, editor.selection.focus?.path);
        Transforms.select(editor, parentPath);
      }

      editLink(editor, { url: linkUrl, text: selectedText });
      setPopoverOpen(false);
      editor.lastInsertedLinkPath = null; */
    };

    const replaceText = () => {
      // If the selection is collapsed, we select the parent node because we want all the link to be replaced)
      if (editor.selection && Range.isCollapsed(editor.selection)) {
        const [, parentPath] = Editor.parent(editor, editor.selection.focus?.path);
        Transforms.select(editor, parentPath);
      }

      editLink(editor, { url: '', text: aiGeneratedContent });
      setPopoverOpen(false);
      editor.lastInsertedLinkPath = null;
    }

    const handleDismiss = () => {
      setPopoverOpen(false);

      if (link.url === '') {
        removeLink(editor);
      }

      ReactEditor.focus(editor);
    };

    const inputNotDirty = !selectedText;

    const composedRefs = composeRefs(linkRef, forwardedRef);

    const requestAI = async (prompt: string) => {
      let text = '';
      try {
        const stream = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        });
        for await (const chunk of stream) {

          text = text + (chunk.choices[0]?.delta?.content || '')
          setAIgeneratedContent(text)
        }
      } catch (error) {

      }
    }

    const makeShorter = (e: any) => {
      requestAI(`Make this text shorter: ${selectedText}`);
    }

    const makeLonger = (e: any) => {
      requestAI(`Make this text shorter: ${selectedText}`);
    }

    React.useEffect(() => {
      // Focus on the link input element when the popover opens
      if (popoverOpen) linkInputRef.current?.focus();
    }, [popoverOpen]);

    return (
      <>
        <Typography
          {...attributes}
          ref={composedRefs}
          color="primary600"
        >
          {children}
        </Typography>
        {popoverOpen && (
          <Popover source={linkRef} onDismiss={handleDismiss} padding={4} contentEditable={false}>
            <Flex as="form" onSubmit={handleSave} direction="column" gap={4}>
              <Field width="368px">
                <Flex direction="column" gap={1} alignItems="stretch">
                  <FieldLabel>
                    What could make Strapi for you?
                  </FieldLabel>
                  <FieldInput
                    name="text"
                    placeholder={formatMessage({
                      id: 'components.Blocks.popover.text.placeholder',
                      defaultMessage: 'Enter link text',
                    })}
                    value={userPrompt}
                    onChange={(e) => {
                      setUserPrompt(e.target.value);
                    }}
                  />
                  <Button onClick={makeShorter}>Make shorter</Button>
                  <Button onClick={makeLonger}>Make longer</Button>
                </Flex>
                {/* <Button type="submit" disabled={Boolean(inputNotDirty) || isSaveDisabled}>
                  Generate
                </Button> */}
              </Field>
              <Flex width="368px">
                <Typography color="primary600">{aiGeneratedContent}</Typography>
              </Flex>
              <Flex justifyContent="left" width="100%">
                <Flex gap={2}>
                  <Button variant="tertiary" onClick={handleDismiss}>
                    {formatMessage({
                      id: 'components.Blocks.popover.cancel',
                      defaultMessage: 'Cancel',
                    })}
                  </Button>
                  {aiGeneratedContent.length > 1 &&
                    <Button onClick={replaceText}>
                      Replace
                    </Button>
                  }
                </Flex>
              </Flex>
            </Flex>
          </Popover>
        )}
      </>
    );
  }
);

const Link = React.forwardRef<HTMLAnchorElement, RenderElementProps>((props, forwardedRef) => {
  if (!isLinkNode(props.element)) {
    return null;
  }

  // LinkContent uses React hooks that rely on props.element being a link. If the type guard above
  // doesn't pass, those hooks would be called conditionnally, which is not allowed.
  // Hence the need for a separate component.
  return <LinkContent {...props} link={props.element} ref={forwardedRef} />;
});

const linkBlocks: Pick<BlocksStore, 'link'> = {
  link: {
    renderElement: (props) => (
      <Link element={props.element} attributes={props.attributes}>
        {props.children}
      </Link>
    ),
    // No handleConvert here, links are created via the link button in the toolbar
    matchNode: (node) => node.type === 'link',
    isInBlocksSelector: false,
  },
};

export { linkBlocks };
