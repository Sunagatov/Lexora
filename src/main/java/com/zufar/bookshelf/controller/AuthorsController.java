package com.zufar.bookshelf.controller;

import com.zufar.bookshelf.dao.author.model.Author;
import com.zufar.bookshelf.service.AuthorService;
import com.zufar.bookshelf.service.BookService;
import com.zufar.bookshelf.service.CountryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@Controller("authors")
@RequiredArgsConstructor
public class AuthorsController {

    private final AuthorService authorService;
    private final BookService bookService;
    private final CountryService countryService;

    @GetMapping("/authors")
    public String getAll(ModelMap modelMap) {
        modelMap.addAttribute("authors", authorService.getAll());
        return "lists/authorListView";
    }

    @GetMapping("/authors/{id}")
    public String get(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("author", authorService.get(id));
        return "profiles/authorProfileView";
    }

    @GetMapping("/addAuthorForm")
    public String getAddForm(ModelMap modelMap) {
        modelMap.addAttribute("author", new Author());
        modelMap.addAttribute("books", bookService.getAll());
        modelMap.addAttribute("countries", countryService.getAll());
        return "crud/addAuthorView";
    }

    @GetMapping("/updateAuthorForm/{id}")
    public String getUpdateAuthorView(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("author", authorService.get(id));
        modelMap.addAttribute("books", bookService.getAll());
        modelMap.addAttribute("countries", countryService.getAll());
        return "crud/updateAuthorView";
    }

    @PostMapping("/authors")
    public String add(Author author, ModelMap modelMap) {
        authorService.save(author);
        modelMap.addAttribute("authors", authorService.getAll());
        return "lists/authorListView";
    }

    @PostMapping("/authors/{id}")
    public String update(@PathVariable(value = "id") long id, Author author, ModelMap modelMap) throws Exception {
        author.setId(id);
        authorService.update(author);
        modelMap.addAttribute("authors", authorService.getAll());
        return "lists/authorListView";
    }

    @PostMapping("/deleteAuthor/{id}")
    public String delete(@PathVariable(value = "id") long id, ModelMap modelMap) {
        authorService.delete(id);
        modelMap.addAttribute("authors", authorService.getAll());
        return "lists/authorListView";
    }
}
