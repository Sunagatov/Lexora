package com.zufar.bookshelf.controller;

import com.zufar.bookshelf.entity.Author;
import com.zufar.bookshelf.service.AuthorService;
import com.zufar.bookshelf.service.BookService;
import com.zufar.bookshelf.service.CountryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@Controller("authors")
public class AuthorsController {

    private final AuthorService authorService;
    private final BookService bookService;
    private final CountryService countryService;

    @Autowired
    public AuthorsController(AuthorService authorService,
                             BookService bookService,
                             CountryService countryService) {
        this.authorService = authorService;
        this.bookService = bookService;
        this.countryService = countryService;
    }

    @GetMapping("/authors")
    public String getAuthors(ModelMap modelMap) {
        modelMap.addAttribute("authors", authorService.getAll());
        return "lists/authorListView";
    }

    @GetMapping("/authors/{id}")
    public String getAuthor(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("author", authorService.get(id));
        return "profiles/authorProfileView";
    }

    @GetMapping("/addAuthorView")
    public String getAddAuthorView(ModelMap modelMap) {
        modelMap.addAttribute("author", new Author());
        modelMap.addAttribute("books", bookService.getAll());
        modelMap.addAttribute("countries", countryService.getAll());
        return "crud/addAuthorView";
    }

    @GetMapping("/updateAuthorView/{id}")
    public String getUpdateAuthorView(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("author", authorService.get(id));
        modelMap.addAttribute("books", bookService.getAll());
        modelMap.addAttribute("countries", countryService.getAll());
        return "crud/updateAuthorView";
    }

    @PostMapping("/addAuthor")
    public String addAuthor(Author author, ModelMap modelMap) {
        authorService.save(author);
        modelMap.addAttribute("authors", authorService.getAll());
        return "lists/authorListView";
    }

    @PostMapping("/updateAuthor")
    public String updateAuthor(Author author, ModelMap modelMap) {
        authorService.update(author);
        modelMap.addAttribute("authors", authorService.getAll());
        return "lists/authorListView";
    }

    @GetMapping("/deleteAuthor/{id}")
    public String deleteAuthor(@PathVariable(value = "id") long id, ModelMap modelMap) {
        authorService.delete(id);
        modelMap.addAttribute("authors", authorService.getAll());
        return "lists/authorListView";
    }
}
