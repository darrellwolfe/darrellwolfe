local utils = require("pandoc.utils")

local NBSP = utf8.char(160)

local function trim(text)
  return (text:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function clean_text(text)
  return trim((text or ""):gsub(NBSP, " "))
end

local function has_class(el, pattern)
  if not el.classes then
    return false
  end

  for _, class_name in ipairs(el.classes) do
    if class_name == pattern or class_name:match(pattern) then
      return true
    end
  end

  return false
end

local function list_contains_visible_content(inlines)
  for _, inline in ipairs(inlines) do
    if inline.t == "Space" or inline.t == "SoftBreak" or inline.t == "LineBreak" then
      -- Skip whitespace-only inlines.
    elseif inline.t == "Str" then
      if clean_text(inline.text) ~= "" then
        return true
      end
    elseif inline.t == "Image" or inline.t == "Math" or inline.t == "Code" or inline.t == "Note" then
      return true
    elseif inline.t == "Link" then
      if #inline.content == 1 and inline.content[1].t == "Image" then
        return true
      end
      if list_contains_visible_content(inline.content) then
        return true
      end
    elseif inline.t == "Span"
      or inline.t == "Emph"
      or inline.t == "Strong"
      or inline.t == "Underline"
      or inline.t == "Strikeout"
      or inline.t == "Superscript"
      or inline.t == "Subscript"
      or inline.t == "SmallCaps"
      or inline.t == "Quoted"
      or inline.t == "Cite" then
      if list_contains_visible_content(inline.content) then
        return true
      end
    else
      return true
    end
  end

  return false
end

local function drop_raw_html(text)
  local lower = (text or ""):lower()
  if lower:match("^%s*<!%-%-") then
    return true
  end
  if lower:match("<o:p") or lower:match("</o:p") then
    return true
  end
  if lower:match("<iframe") or lower:match("<script") or lower:match("<style") then
    return true
  end
  if lower:match("<xml") or lower:match("</xml") or lower:match("<w:") then
    return true
  end
  return false
end

function RawBlock(el)
  if el.format == "html" and drop_raw_html(el.text) then
    return {}
  end
end

function RawInline(el)
  if el.format == "html" and drop_raw_html(el.text) then
    return {}
  end
end

function Div(el)
  local text = clean_text(utils.stringify(el))

  if has_class(el, "^MsoToc") then
    return {}
  end

  if has_class(el, "^MsoTitle$") and text == "Table of Contents" then
    return {}
  end

  return el.content
end

function Span(el)
  return el.content
end

function Link(el)
  local target = el.target or ""

  if target:match("^https?://draft%.blogger%.com/null") then
    return el.content
  end

  if target:match("^#_Toc%d+") then
    return el.content
  end

  return pandoc.Link(el.content, target, el.title)
end

function Image(el)
  local src = el.src or ""
  local width = (el.attributes and el.attributes.width) or ""
  local height = (el.attributes and el.attributes.height) or ""

  if src:match("amazon%-adsystem%.com/e/ir") or width == "1" or height == "1" then
    return {}
  end

  return pandoc.Image(el.caption, src, el.title)
end

function Header(el)
  if clean_text(utils.stringify(el)) == "Table of Contents" then
    return {}
  end

  if el.attr then
    el.attr = pandoc.Attr()
  end

  return el
end

function Table(el)
  if el.attr then
    el.attr = pandoc.Attr()
  end

  return el
end

function Para(el)
  if list_contains_visible_content(el.content) then
    return el
  end

  return {}
end

function Plain(el)
  if list_contains_visible_content(el.content) then
    return el
  end

  return {}
end
