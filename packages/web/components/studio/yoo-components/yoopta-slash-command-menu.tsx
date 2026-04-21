import { SlashCommandMenu } from '@yoopta/ui/slash-command-menu';
import { 
  Text, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Code2, 
  AlertCircle, 
  Minus, 
  Image as ImageIcon, 
  Table as TableIcon, 
  Link as LinkIcon,
  Workflow
} from 'lucide-react';

const ICONS_MAP: Record<string, React.ElementType> = {
  Paragraph: Text,
  HeadingOne: Heading1,
  HeadingTwo: Heading2,
  HeadingThree: Heading3,
  Blockquote: Quote,
  Callout: AlertCircle,
  BulletedList: List,
  NumberedList: ListOrdered,
  TodoList: CheckSquare,
  Code: Code2,
  Image: ImageIcon,
  Table: TableIcon,
  Divider: Minus,
  Link: LinkIcon,
  Mermaid: Workflow,
};

export const YooptaSlashCommandMenu = () => (
  <SlashCommandMenu>
    {(props) => {
      if (!props.items || props.items.length === 0) {
        return (
          <SlashCommandMenu.Content data-testid="studio-yoopta-slash-menu">
            <div className="p-4 text-center text-sm text-gray-500">
              No blocks available
            </div>
          </SlashCommandMenu.Content>
        );
      }

      return (
        <SlashCommandMenu.Content data-testid="studio-yoopta-slash-menu">
          <SlashCommandMenu.List>
            <SlashCommandMenu.Empty>No blocks found</SlashCommandMenu.Empty>
            {props.items.map((item) => {
              const Icon = ICONS_MAP[item.id] || Text;

              return (
                <SlashCommandMenu.Item
                  key={item.id}
                  value={item.id}
                  title={item.title}
                  description={item.description}
                  icon={<Icon size={16} />}
                  data-testid={`studio-yoopta-slash-item-${item.id}`}
                />
              );
            })}
          </SlashCommandMenu.List>
          <SlashCommandMenu.Footer />
        </SlashCommandMenu.Content>
      );
    }}
  </SlashCommandMenu>
);
