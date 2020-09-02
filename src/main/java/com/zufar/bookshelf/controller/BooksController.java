package com.zufar.bookshelf.controller;

import com.zufar.bookshelf.entity.Book;
import com.zufar.bookshelf.service.AuthorService;
import com.zufar.bookshelf.service.BookService;
import com.zufar.bookshelf.service.CountryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
@RequiredArgsConstructor
public class BooksController {

    private final BookService bookService;
    private final AuthorService authorService;
    private final CountryService countryService;

    @GetMapping("/books")
    public String getAll(ModelMap modelMap) {
        modelMap.addAttribute("books", bookService.getAll());
        return "lists/bookListView";
    }

    @GetMapping("/books/{id}")
    public String get(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("book", bookService.get(id));
        return "profiles/bookProfileView";
    }

    @GetMapping("/addBookForm")
    public String getAddForm(ModelMap modelMap) {
        modelMap.addAttribute("book", new Book());
        modelMap.addAttribute("authors", authorService.getAll());
        modelMap.addAttribute("countries", countryService.getAll());
        return "crud/addBookView";
    }

    @GetMapping("/updateBookForm/{id}")
    public String getUpdateBookView(@PathVariable(value = "id") long id, ModelMap modelMap) {
        modelMap.addAttribute("book", bookService.get(id));
        modelMap.addAttribute("authors", authorService.getAll());
        modelMap.addAttribute("countries", countryService.getAll());
        return "crud/updateBookView";
    }

    @PostMapping("/books")
    public String add(Book book, ModelMap modelMap) throws Exception {
        bookService.save(book);
        modelMap.addAttribute("books", bookService.getAll());
        return "lists/bookListView";
    }

    @PostMapping("/books/{id}")
    public String update(@PathVariable(value = "id") long id, Book book, ModelMap modelMap) throws Exception {
        book.setId(id);
        bookService.update(book);
        modelMap.addAttribute("books", bookService.getAll());
        return "lists/bookListView";
    }

    @PostMapping("/deleteBook/{id}")
    public String delete(@PathVariable(value = "id") long id, ModelMap modelMap) {
        bookService.delete(id);
        modelMap.addAttribute("books", bookService.getAll());
        return "lists/bookListView";
    }
}
