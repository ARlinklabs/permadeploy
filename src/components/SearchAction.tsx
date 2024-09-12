import React, { useState } from 'react';
import { Search, ChevronDown, LayoutGrid, List, Plus } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SearchActionBar = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="flex items-center space-x-4 pb-4 text-white">
      <div className="flex-grow relative">
        <Input
          type="text"
          placeholder="Search Repositories and Projects..."
          className="w-full pl-10 pr-4 py-2 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="text-white border-gray-700">
            Sort by activity <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Most active</DropdownMenuItem>
          <DropdownMenuItem>Least active</DropdownMenuItem>
          <DropdownMenuItem>Recently updated</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex rounded-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewMode('grid')}
          className={`p-2 ${viewMode === 'grid' ? 'bg-gray-700' : ''}`}
        >
          <LayoutGrid size={20} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewMode('list')}
          className={`p-2 ${viewMode === 'list' ? 'bg-gray-700' : ''}`}
        >
          <List size={20} />
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-white text-black">
            Add New... <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>New Repository</DropdownMenuItem>
          <DropdownMenuItem>New Project</DropdownMenuItem>
          <DropdownMenuItem>Import Repository</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default SearchActionBar;